curl -X POST "https://api.mux.com/video/v1/assets/xAuUQlV5XNVAA02eLuzqoeSBWtA026GWIqsjQGFKs7XDs/tracks" \
  -u "$MUX_TOKEN_ID:$MUX_TOKEN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://alecandmk.stream/assets/captions/iwis.srt",
    "type": "text",
    "text_type": "subtitles",
    "language_code": "en",
    "name": "English",
    "closed_captions": true
  }'


  curl https://api.mux.com/video/v1/assets/CxJmQI5lcP2FnPh2bvpXEl5u5lCyvPaRcTGb16wnLcg/tracks/D6Wy24jeBFlNM0202FeBo401kHjSMBg3hJg9bKUGbwOC01JX51HDweqjmA \
  -X DELETE \
  -H "Content-Type: application/json" \
  -u ${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}