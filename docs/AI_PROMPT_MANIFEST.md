# `docs/AI_PROMPT_MANIFEST.md` - Unified Prompt Repository & JSON Validation Schemas

This document establishes the official, immutable system personas, prompt architectures, and structured JSON schemas for all artificial intelligence workflows across **FloraFlow**. **The Mind (Architect Agent)** and **The Plumber (Protocol Agent)** must reference this file directly when deploying or modifying LLM engine processing pipelines.

---

## 0. Shared Error Response Schema

All three AI pipelines (Scribe, Plant Identifier, Leaf Doctor) return this shape when an error occurs. Edge Functions must return HTTP 400 for client errors (bad image, missing fields) and HTTP 503 for upstream API failures.

```ts
interface AIErrorResponse {
  error:      string;       // human-readable message
  error_code: 'INVALID_IMAGE' | 'VALIDATION_FAILED' | 'API_ERROR' | 'TIMEOUT';
}
```

## 0.1 Shared Confidence Score Thresholds

Used consistently across Plant Identifier and Leaf Doctor schemas:

| Range | Meaning | UI behaviour |
|---|---|---|
| `< 0.50` | Uncertain — insufficient visual evidence | Show warning; prompt user to try a clearer photo |
| `0.50 – 0.75` | Probable — reasonable match | Show result with a "Low confidence" badge |
| `> 0.75` | Confident — strong visual evidence | Show result normally |

---

## 1. Core AI Scribe: Taxonomy Data Enrichment (Phase 2/3)

- **Trigger Context:** Executed when the Perenual species details response is missing fields (pH range, toxicity notes, propagation methods). Also triggered when PlantNet identifies a species not found in Perenual. **Important:** PlantNet is an identification source only — it returns taxonomy (score, scientific name, family) but never care metrics. The Scribe always enriches from Perenual first; it fills remaining gaps when Perenual also returns nulls.
- **Target Interface:** Supabase Deno Edge Function (`supabase/functions/claude-enrichment`)
- **Model Class:** Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) — fast, structured JSON output
- **max_tokens:** `512` — JSON schema output is compact; no prose expected

### 🤖 1.1 System Prompt Definition

    You are the FloraFlow AI Scribe, an elite botanical taxonomist and agricultural data scientist. Your absolute directive is to provide highly precise, empirically grounded plant care metrics. You never hallucinate, invent unverified horticultural parameters, or generate prose.

    When provided with a target species common name and scientific name, you must calculate and extract specific care parameters based exclusively on known botanical benchmarks for that genus. If a specific metric is completely undocumented or highly speculative, you must return a null field value or use the fallback standard defined in the schema.

### 📝 1.2 Outbound JSON Schema Structure

The inference pipeline must strictly mandate a JSON Schema response matching your PostgreSQL database formats exactly:

    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "scientific_name": { "type": "string" },
        "common_name": { "type": "string" },
        "ideal_min_ph": {
          "type": "number",
          "minimum": 1.0,
          "maximum": 14.0,
          "default": 6.0
        },
        "ideal_max_ph": {
          "type": "number",
          "minimum": 1.0,
          "maximum": 14.0,
          "default": 7.0
        },
        "is_toxic_to_pets": { "type": "boolean" },
        "toxicity_notes": {
          "type": ["string", "null"],
          "description": "Populated only when is_toxic_to_pets is true. Brief clinical note, e.g. 'Causes kidney failure in cats. Seek vet immediately.' Null for non-toxic species."
        },
        "propagation_methods": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["Stem Cuttings", "Leaf Cuttings", "Division", "Seeds", "Air Layering", "Offset Separation"]
          }
        },
        "is_ai_enriched": { "type": "boolean", "const": true }
      },
      "required": ["scientific_name", "common_name", "ideal_min_ph", "ideal_max_ph", "is_toxic_to_pets", "toxicity_notes", "propagation_methods", "is_ai_enriched"]
    }

---

## 2. Core AI Plant Identifier: Photo-to-Species Recognition (Phase 3)

- **Trigger Context:** User uploads or snaps a photo inside the Add Plant form flow when they do not know the species name.
- **Target Interface:** Angular Add-Plant form component to Supabase Edge Function (`supabase/functions/claude-plant-id`)
- **Model Class:** Anthropic Claude Sonnet (`claude-sonnet-4-6`) — multimodal image analysis
- **max_tokens:** `1024` — image analysis produces a richer JSON payload than text-only enrichment

> **Vision call format:** See **section 3.0** for the exact `messages` array shape used to send base64 images to Claude. The same pattern applies here.

### 🤖 2.1 System Prompt Definition

    You are the FloraFlow AI Plant Identifier, a specialist botanical taxonomist trained in visual species recognition across vascular plants, succulents, ferns, mosses, and cultivated crops.

    CRITICAL GUARDRAILS:
    1. If the uploaded image does not clearly show a plant, leaf structure, stem, flower, or root system, set is_plant_image to false and populate error_message. Do not attempt identification.
    2. Never hallucinate a species. If visual evidence is insufficient for confident identification, lower the confidence_score accordingly and populate alternative_candidates with plausible matches.
    3. Return exclusively a valid, parseable JSON structure. No prose, no greetings, no markdown.

### 📝 2.2 Outbound JSON Schema Structure

    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "is_plant_image": { "type": "boolean" },
        "error_message": {
          "type": ["string", "null"],
          "description": "Populated only if is_plant_image is false."
        },
        "species_match": {
          "type": ["object", "null"],
          "description": "Primary identification result. Null if is_plant_image is false.",
          "properties": {
            "common_name": { "type": "string" },
            "scientific_name": { "type": "string" },
            "confidence_score": {
              "type": "number",
              "minimum": 0.0,
              "maximum": 1.0,
              "description": "Model confidence in the primary match. Below 0.6 is considered low confidence."
            }
          },
          "required": ["common_name", "scientific_name", "confidence_score"]
        },
        "alternative_candidates": {
          "type": "array",
          "maxItems": 3,
          "description": "Up to three alternative species if the primary match confidence is below 0.85.",
          "items": {
            "type": "object",
            "properties": {
              "common_name": { "type": "string" },
              "scientific_name": { "type": "string" },
              "confidence_score": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
            },
            "required": ["common_name", "scientific_name", "confidence_score"]
          }
        }
      },
      "required": ["is_plant_image", "error_message", "species_match", "alternative_candidates"]
    }

---

## 3. Core AI Leaf Doctor: Multimodal Vision Diagnostics (Phase 3)

- **Trigger Context:** User snaps or uploads an image within their care log timeline to analyze structural distress or discoloration.
- **Target Interface:** Angular Presentational Layer Component to Supabase Edge Function Proxying Claude Multimodal API Endpoint (`supabase/functions/claude-vision`)
- **Model Class:** Anthropic Claude Sonnet (`claude-sonnet-4-6`) — multimodal image analysis
- **max_tokens:** `1024` — diagnostic arrays and remediation steps may be verbose

### 🤖 3.1 System Prompt Definition

    You are the FloraFlow AI Leaf Doctor, an advanced computer vision diagnostic engine specializing in agricultural pathology, plant physiology, and soil sciences.

    CRITICAL GUARDRAILS:
    1. If the uploaded image does not primarily focus on a plant asset, leaf structure, or cultivation soil layer, immediately return an error state indicating a non-botanical image was provided.
    2. Do not include casual pleasantries, greetings, or loose text explanations. You must communicate exclusively using a valid, parseable JSON data structure.

### 📡 3.0 Vision API Call Format

Both the Plant Identifier and the Leaf Doctor send an image to Claude. The image must be base64-encoded and passed as an `image` content block — not as a URL or plain text.

The Edge Function receives the image as a base64 string from the Angular client. Here is the exact `messages` array shape to use with the Anthropic SDK:

```ts
const msg = await anthropic.messages.create({
  model:      'claude-sonnet-4-6',
  max_tokens: 1024,
  system:     '...system prompt from section 2.1 or 3.1...',
  messages: [
    {
      role: 'user',
      content: [
        {
          type:   'image',
          source: {
            type:       'base64',
            media_type: imageMediaType, // 'image/jpeg' | 'image/png' | 'image/webp'
            data:        imageBase64,   // raw base64 string, no data-URI prefix
          },
        },
        {
          type: 'text',
          text: 'Analyze this image and return a JSON response matching the schema.',
        },
      ],
    },
  ],
});
```

The Angular client must strip the `data:image/jpeg;base64,` prefix before sending `imageBase64` to the Edge Function — only the raw base64 payload is valid here.

### 📝 3.2 Outbound JSON Schema Structure

    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "is_botanical_image": { "type": "boolean" },
        "error_message": {
          "type": ["string", "null"],
          "description": "Populated only if is_botanical_image is false."
        },
        "diagnostics": {
          "type": ["object", "null"],
          "properties": {
            "primary_condition": {
              "type": "string",
              "description": "e.g., Nitrogen Deficiency, Powdery Mildew, Spider Mites, Overwatering Root Rot."
            },
            "confidence_score": {
              "type": "number",
              "minimum": 0.0,
              "maximum": 1.0,
              "description": "See shared confidence thresholds in section 0.1."
            },
            "immediate_remedial_actions": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Step-by-step, actionable tasks the gardener must execute to rescue the asset."
            },
            "systemic_risk_assessment": {
              "type": "string",
              "enum": ["Isolated", "ZoneContagious", "FatalThreat"],
              "description": "How dangerous this specific issue is to surrounding plants in the environment."
            }
          },
          "required": ["primary_condition", "confidence_score", "immediate_remedial_actions", "systemic_risk_assessment"]
        }
      },
      "required": ["is_botanical_image", "error_message", "diagnostics"]
    }
