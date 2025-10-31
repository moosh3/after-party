curl -X POST "https://api.mux.com/video/v1/assets/CxJmQI5lcP2FnPh2bvpXEl5u5lCyvPaRcTGb16wnLcg/tracks" \
  -u "$MUX_TOKEN_ID:$MUX_TOKEN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://alecandmk.stream/captions/corpse-bride.srt",
    "type": "text",
    "text_type": "subtitles",
    "language_code": "en",
    "name": "English",
    "closed_captions": true
  }'


  curl https://api.mux.com/video/v1/assets/${ASSET_ID}/tracks/${TRACK_ID} \
  -X DELETE \
  -H "Content-Type: application/json" \
  -u ${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}