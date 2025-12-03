#!/usr/bin/env python3
# Minimal proxy server for Imagen 4 generation via AiHubMix
# Usage:
#   pip install flask pillow google-genai
#   export AIHUBMIX_API_KEY=your_key_here
#   python server/imagen4_proxy.py
# This exposes POST /api/imagen4 expecting JSON:
#   { "prompt": "...", "number_of_images": 1, "aspect_ratio": "1:1" }
# Returns JSON: { "images": [ { "b64": "..." }, ... ] }

import os
import base64
from flask import Flask, request, jsonify
from flask import Response
from flask_cors import CORS

try:
    from google import genai
    from google.genai import types
except Exception as e:
    genai = None
    types = None

app = Flask(__name__)
CORS(app)


def get_client():
    api_key = os.environ.get('AIHUBMIX_API_KEY')
    if not api_key:
        raise RuntimeError('Missing AIHUBMIX_API_KEY environment variable')
    if genai is None:
        raise RuntimeError('google-genai not installed. pip install google-genai')
    client = genai.Client(
        api_key=api_key,
        http_options={"base_url": "https://aihubmix.com/gemini"},
    )
    return client


@app.route('/api/imagen4', methods=['POST'])
def imagen4():
    data = request.get_json(silent=True) or {}
    prompt = (data.get('prompt') or '').strip()
    aspect_ratio = data.get('aspect_ratio') or '1:1'
    number_of_images = int(data.get('number_of_images') or 1)
    if not prompt:
        return jsonify({"error": "prompt is required"}), 400
    if number_of_images < 1 or number_of_images > 4:
        return jsonify({"error": "number_of_images must be 1..4"}), 400

    try:
        client = get_client()
        resp = client.models.generate_images(
            model='imagen-4.0-fast-generate-001',
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=number_of_images,
                aspect_ratio=aspect_ratio,
            )
        )
        images = []
        if hasattr(resp, 'generated_images') and resp.generated_images:
            for gi in resp.generated_images:
                try:
                    b64 = None
                    if getattr(gi, 'image', None) and getattr(gi.image, 'image_bytes', None):
                        # image_bytes already base64 from SDK
                        b64 = gi.image.image_bytes
                    elif getattr(gi, 'image', None) and getattr(gi.image, 'data', None):
                        b64 = base64.b64encode(gi.image.data).decode('utf-8')
                    if b64:
                        images.append({"b64": b64})
                except Exception as e:
                    print('Error handling generated image:', e)
        return jsonify({"images": images})
    except Exception as e:
        print('Proxy error:', repr(e))
        return jsonify({"error": str(e)}), 500


@app.route('/healthz')
def health():
    return Response('ok', 200)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5001'))
    app.run(host='127.0.0.1', port=port, debug=True)

