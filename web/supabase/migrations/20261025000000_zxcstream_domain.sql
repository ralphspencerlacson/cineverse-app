-- Update existing sources without adding any fallback rows.
update cineverse.player_sources
set movie_url_template = replace(movie_url_template, 'https://zxcstream.xyz', 'https://zxcstream.com'),
    tv_url_template = replace(tv_url_template, 'https://zxcstream.xyz', 'https://zxcstream.com'),
    updated_at = now()
where movie_url_template like 'https://zxcstream.xyz/%'
   or tv_url_template like 'https://zxcstream.xyz/%';
