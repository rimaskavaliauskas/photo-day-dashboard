-- Mock User Settings (already exists but ensuring)
INSERT OR IGNORE INTO user_settings (id, base_lat, base_lng) VALUES (1, 54.6872, 25.2797);

-- Mock Weather Slots (24 hours)
DELETE FROM weather_slots;
INSERT INTO weather_slots (date_time, lat, lng, clouds, temp, photoday_score) VALUES 
(datetime('now', '+0 hours'), 54.6872, 25.2797, 10, 18, 90),
(datetime('now', '+1 hours'), 54.6872, 25.2797, 15, 19, 85),
(datetime('now', '+2 hours'), 54.6872, 25.2797, 20, 20, 80),
(datetime('now', '+3 hours'), 54.6872, 25.2797, 40, 21, 60),
(datetime('now', '+4 hours'), 54.6872, 25.2797, 80, 20, 30),
(datetime('now', '+5 hours'), 54.6872, 25.2797, 100, 19, 10),
(datetime('now', '+6 hours'), 54.6872, 25.2797, 90, 18, 20),
(datetime('now', '+7 hours'), 54.6872, 25.2797, 60, 17, 40),
(datetime('now', '+8 hours'), 54.6872, 25.2797, 10, 16, 95), -- Golden Hour Peak
(datetime('now', '+9 hours'), 54.6872, 25.2797, 0, 15, 100),
(datetime('now', '+10 hours'), 54.6872, 25.2797, 0, 14, 100),
(datetime('now', '+11 hours'), 54.6872, 25.2797, 5, 14, 95),
(datetime('now', '+12 hours'), 54.6872, 25.2797, 10, 13, 90),
(datetime('now', '+13 hours'), 54.6872, 25.2797, 10, 13, 90),
(datetime('now', '+14 hours'), 54.6872, 25.2797, 20, 12, 80),
(datetime('now', '+15 hours'), 54.6872, 25.2797, 30, 12, 70),
(datetime('now', '+16 hours'), 54.6872, 25.2797, 40, 11, 60),
(datetime('now', '+17 hours'), 54.6872, 25.2797, 50, 11, 50),
(datetime('now', '+18 hours'), 54.6872, 25.2797, 60, 10, 40),
(datetime('now', '+19 hours'), 54.6872, 25.2797, 70, 10, 30),
(datetime('now', '+20 hours'), 54.6872, 25.2797, 80, 9, 20),
(datetime('now', '+21 hours'), 54.6872, 25.2797, 90, 9, 10),
(datetime('now', '+22 hours'), 54.6872, 25.2797, 95, 8, 5),
(datetime('now', '+23 hours'), 54.6872, 25.2797, 100, 8, 0);

-- Mock My Places
DELETE FROM my_places;
INSERT INTO my_places (name, lat, lng, active) VALUES 
('Gediminas Tower', 54.6872, 25.2797, 1),
('Trakai Castle', 54.6518, 24.9332, 1),
('Hill of Crosses', 56.0153, 23.4167, 1);

-- Mock Place Forecasts (for My Places)
-- Note: IDs match insertion order (1, 2, 3)
DELETE FROM place_forecasts;
INSERT INTO place_forecasts (place_id, date, sky_open_evening) VALUES 
(1, date('now'), 1), -- Clear
(2, date('now'), 0), -- Cloudy
(3, date('now'), 1); -- Clear

-- Mock Sun Windows
DELETE FROM sun_windows;
INSERT INTO sun_windows (date, lat, lng, golden_evening_start) VALUES 
(date('now'), 54.6872, 25.2797, datetime('now', '+8 hours'));
