import { Env, MyPlace } from '../types';

/**
 * Google Sheets API Integration
 * 
 * Read places from Google Sheet and write pinned places back.
 * Uses Service Account authentication.
 */

// JWT Header for Google API auth
const JWT_HEADER = {
    alg: 'RS256',
    typ: 'JWT',
};

/**
 * Create a signed JWT for Google API authentication
 */
async function createJWT(env: Env): Promise<string> {
    const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!email || !privateKey) {
        throw new Error('Google Service Account credentials not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    const payload = {
        iss: email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: expiry,
    };

    // Encode header and payload
    const encodedHeader = btoa(JSON.stringify(JWT_HEADER)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Import the private key and sign
    const pemContents = privateKey
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '');

    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(signatureInput)
    );

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${signatureInput}.${encodedSignature}`;
}

/**
 * Get an access token from Google OAuth
 */
async function getAccessToken(env: Env): Promise<string> {
    const jwt = await createJWT(env);

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${error}`);
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
}

/**
 * Read places from Google Sheet
 * Expected columns: name, lat, lng, notes
 */
export async function readPlacesFromSheet(env: Env): Promise<MyPlace[]> {
    const sheetId = env.GOOGLE_SHEET_ID;
    if (!sheetId) {
        console.warn('GOOGLE_SHEET_ID not configured, skipping sheet sync');
        return [];
    }

    try {
        const accessToken = await getAccessToken(env);

        // Read all rows from Sheet1, columns A-D (name, lat, lng, notes)
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:D`;

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to read sheet: ${error}`);
        }

        const data = await response.json() as { values?: string[][] };

        if (!data.values || data.values.length < 2) {
            console.log('No data in sheet (or only header row)');
            return [];
        }

        // Skip header row, parse data rows
        const places: MyPlace[] = [];
        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row.length >= 3 && row[0] && row[1] && row[2]) {
                const lat = parseFloat(row[1]);
                const lng = parseFloat(row[2]);

                if (!isNaN(lat) && !isNaN(lng)) {
                    places.push({
                        sheet_row: i + 1, // 1-indexed row number
                        name: row[0].trim(),
                        lat,
                        lng,
                        notes: row[3]?.trim() || null,
                    });
                }
            }
        }

        console.log(`Read ${places.length} places from sheet`);
        return places;
    } catch (error) {
        console.error('Error reading from sheet:', error);
        return [];
    }
}

/**
 * Append a new place to the Google Sheet (when pinning)
 */
export async function appendPlaceToSheet(env: Env, place: MyPlace): Promise<boolean> {
    const sheetId = env.GOOGLE_SHEET_ID;
    if (!sheetId) {
        console.warn('GOOGLE_SHEET_ID not configured, cannot write to sheet');
        return false;
    }

    try {
        const accessToken = await getAccessToken(env);

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:D:append?valueInputOption=USER_ENTERED`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                values: [[place.name, place.lat, place.lng, place.notes || '']],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to append to sheet: ${error}`);
        }

        console.log(`Appended place "${place.name}" to sheet`);
        return true;
    } catch (error) {
        console.error('Error appending to sheet:', error);
        return false;
    }
}

/**
 * Sync places from Google Sheet to database
 */
export async function syncPlacesFromSheet(env: Env): Promise<number> {
    const places = await readPlacesFromSheet(env);

    let synced = 0;
    for (const place of places) {
        try {
            await env.DB
                .prepare(`
          INSERT INTO my_places (sheet_row, name, lat, lng, notes, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(lat, lng) DO UPDATE SET
            sheet_row = excluded.sheet_row,
            name = excluded.name,
            notes = excluded.notes,
            updated_at = datetime('now')
        `)
                .bind(place.sheet_row, place.name, place.lat, place.lng, place.notes)
                .run();
            synced++;
        } catch (error) {
            console.error(`Error syncing place "${place.name}":`, error);
        }
    }

    console.log(`Synced ${synced} places from sheet to database`);
    return synced;
}
