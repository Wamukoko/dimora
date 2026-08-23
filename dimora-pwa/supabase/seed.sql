-- Dimora demo seed.
-- Prerequisite: sign up these accounts via the app (magic link) first:
--   agent@dimora.co.ke   (then elevated to 'agent' by the UPDATE below, run as service role / SQL editor)
--   hunter@dimora.co.ke

UPDATE public.profiles SET role = 'agent', full_name = 'Amina Wanjiru' WHERE email = 'agent@dimora.co.ke';
UPDATE public.profiles SET full_name = 'Brian Otieno' WHERE email = 'hunter@dimora.co.ke';

WITH agent AS (
    SELECT id FROM public.profiles WHERE email = 'agent@dimora.co.ke'
)
INSERT INTO public.properties (agent_id, title, description, price, type, bedrooms, bathrooms,
                               county, sub_county, neighborhood, latitude, longitude, images, is_published)
SELECT a.id, v.title, v.description, v.price, v.type::public.property_type, v.bedrooms, v.bathrooms,
       v.county, v.sub_county, v.neighborhood, v.latitude, v.longitude,
       ARRAY[v.image1, v.image2]::text[], true
FROM agent a
CROSS JOIN (VALUES
    ('Sunlit 2-Bedroom in Kilimani', 'Modern apartment a walk from Yaya Centre. Borehole water, backup generator, secure parking.', 85000, 'apartment', 2, 1, 'Nairobi', 'Nairobi West', 'Kilimani', -1.2921, 36.7819,
     'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1200',
     'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200'),
    ('Family Townhouse in Karen', 'Four-bedroom townhouse on a quarter acre. Mature garden, staff quarters, quiet cul-de-sac.', 180000, 'townhouse', 4, 3, 'Nairobi', 'Nairobi West', 'Karen', -1.3197, 36.7069,
     'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1200',
     'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200'),
    ('Clean Bedsitter in Kileleshwa', 'Self-contained unit with private bathroom and kitchenette. Water always available.', 16000, 'bedsitter', 0, 1, 'Nairobi', 'Nairobi West', 'Kileleshwa', -1.2833, 36.7667,
     'https://images.pexels.com/photos/210617/pexels-photo-210617.jpeg?auto=compress&cs=tinysrgb&w=1200',
     'https://images.pexels.com/photos/1571459/pexels-photo-1571459.jpeg?auto=compress&cs=tinysrgb&w=1200'),
    ('4BR House in Milimani, Kisumu', 'Spacious family home near Milimani Primary. Large compound, fruit trees, perimeter wall.', 70000, 'house', 4, 2, 'Kisumu', 'Kisumu East', 'Milimani', -0.2962, 34.7565,
     'https://images.pexels.com/photos/186077/pexels-photo-186077.jpeg?auto=compress&cs=tinysrgb&w=1200',
     'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=1200')
) AS v(title, description, price, type, bedrooms, bathrooms, county, sub_county, neighborhood, latitude, longitude, image1, image2)
WHERE NOT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.agent_id = a.id AND p.title = v.title AND p.neighborhood = v.neighborhood
);
