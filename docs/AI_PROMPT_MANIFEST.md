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
- **max_tokens:** `1024` — Phase 3.10 expands the schema to ~27 fields; 512 would truncate the JSON and cause a parse failure

### 🤖 1.1 System Prompt Definition

    You are the FloraFlow AI Scribe, an elite botanical taxonomist and agricultural data scientist. Your absolute directive is to provide highly precise, empirically grounded plant care metrics. You never hallucinate, invent unverified horticultural parameters, or generate prose.

    When provided with a target species common name and scientific name, you must extract specific care parameters based exclusively on known botanical benchmarks for that genus and species. If a specific metric is completely undocumented or highly speculative, you must return a null field value — never substitute a plausible-sounding number.

    CRITICAL ACCURACY RULES:
    1. check_depth_description must reflect the species' actual watering requirements — not a generic formula. Aroids typically: "Allow top 2–3 cm to dry". Succulents typically: "Let soil dry completely between waterings". Ferns: "Keep consistently moist, check at the surface." Use null if the species is unknown to you.
    2. ideal_humidity_min and ideal_humidity_max must be species-specific, not category averages. A Pothos and a Calathea are both tropicals but have different humidity tolerances. Use null if the species-specific range is undocumented.
    3. Never invent numbers. A null is always more accurate than a fabricated value.
    4. watering must be exactly one of: 'Frequent', 'Average', 'Minimum', 'None'. Return null if the species' watering needs are ambiguous or unknown.
    5. sunlight must be an array using only these exact values: 'full_sun', 'part_shade', 'full_shade', 'filtered_indirect'. Return null if the species' light requirements are unknown.
    6. cycle must be exactly one of: 'Perennial', 'Annual', 'Biennial', 'Biannual'. Return null if the species lifecycle is unclear.
    7. propagation_methods must only contain values from this exact list: 'Stem Cuttings', 'Leaf Cuttings', 'Division', 'Seeds', 'Air Layering', 'Offset Separation'. Return an empty array [] if none apply or if the species' methods are unknown. Never invent a variant.
    8. description: 1–2 sentences describing the plant's character and key traits in plain English. Include its visual signature and notable use. Example: "A fast-growing tropical aroid with large fenestrated leaves, prized for dramatic foliage and air-purifying qualities." Return null only for highly obscure species.
    9. placement must be exactly one of: 'Indoor', 'Outdoor', 'Both'. 'Indoor' for tender plants unable to survive outdoors in temperate climates. 'Outdoor' for plants requiring direct sun, rain, or frost hardiness. 'Both' for adaptable species. Return null if genuinely unclear.
    10. is_tropical: true for species native to tropical or subtropical regions (typically requiring RH > 50%, minimum temperature > 10°C). false for temperate species. Default to false if uncertain — never null.
    11. is_toxic_to_humans: true if any part of the plant is known to cause harm when ingested or on skin contact. false if known safe or no data. Default to false if uncertain — never null.
    12. human_toxicity_notes: populated only when is_toxic_to_humans is true. Brief clinical note, e.g. "Berries cause severe gastric upset if ingested. Sap may irritate skin and eyes." Return an empty string when is_toxic_to_humans is false.
    13. produces_fruit: true if the species produces fruit (including berries, drupes, pods, hips) in typical cultivation. Default to false if uncertain — never null.
    14. fruit_season: populated only when produces_fruit is true. Use natural language season ranges, e.g. "Late Summer", "Autumn – Winter", "Spring – Summer". Return an empty string when produces_fruit is false.
    15. produces_flowers: true if the species produces flowers in typical cultivation. Default to false if uncertain — never null.
    16. flowering_season: populated only when produces_flowers is true. Same format as fruit_season. Return an empty string when produces_flowers is false.
    17. growth_rate must be exactly one of: 'Slow', 'Moderate', 'Fast'. Based on typical cultivation rate. Return null if genuinely variable or unknown.
    18. maintenance_level must be exactly one of: 'Low', 'Medium', 'High'. 'Low' = tolerates neglect, infrequent watering. 'Medium' = regular watering and occasional attention. 'High' = frequent watering, misting, or precision care required. Return null if unclear.
    19. preferred_soil_type: array of applicable descriptors from this exact list only: 'Well-draining', 'Sandy', 'Loamy', 'Clay', 'Peaty', 'Chalky', 'Rich', 'Poor', 'Moisture-retaining'. Return [] if unknown. Never invent descriptors outside this list.
    20. native_region: plain-text geographic origin, e.g. "Tropical West Africa", "Mediterranean Basin", "Central and South America". Return null if origin is unclear or highly hybridised.
    21. max_height_cm: mature height in centimetres in typical indoor or garden cultivation — not extreme wild specimens. Integer only. Return null if highly variable or unknown.
    22. max_spread_cm: mature lateral spread in centimetres. Integer only. Return null if highly variable or unknown.
    23. air_purifying: true if the plant is documented to filter indoor VOCs (formaldehyde, benzene, trichloroethylene) per NASA Clean Air Study or peer-reviewed equivalent. false otherwise — never null.

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
        "watering": {
          "type": ["string", "null"],
          "enum": ["Frequent", "Average", "Minimum", "None", null],
          "description": "Watering frequency category. Use null if ambiguous or unknown."
        },
        "sunlight": {
          "type": ["array", "null"],
          "items": {
            "type": "string",
            "enum": ["full_sun", "part_shade", "full_shade", "filtered_indirect"]
          },
          "description": "Array of applicable sunlight conditions using canonical snake_case values. Use null if unknown."
        },
        "cycle": {
          "type": ["string", "null"],
          "enum": ["Perennial", "Annual", "Biennial", "Biannual", null],
          "description": "Plant lifecycle type. Use null if unclear."
        },
        "check_depth_description": {
          "type": ["string", "null"],
          "description": "Species-specific soil moisture check guidance. Must reference actual species watering requirements — never invent values. Examples: 'Allow the top 3–4 cm of soil to dry before watering', 'Let soil dry completely between waterings'. Null if insufficient data."
        },
        "ideal_humidity_min": {
          "type": ["integer", "null"],
          "minimum": 10,
          "maximum": 100,
          "description": "Lower bound of the species' preferred relative humidity range (%). Must be species-specific, not a category average. Null if undocumented."
        },
        "ideal_humidity_max": {
          "type": ["integer", "null"],
          "minimum": 10,
          "maximum": 100,
          "description": "Upper bound of the species' preferred relative humidity range (%). Must be species-specific. Null if undocumented."
        },
        "care_difficulty": {
          "type": ["string", "null"],
          "enum": ["Beginner", "Intermediate", "Advanced", null],
          "description": "Difficulty classification based on known species temperament. Beginner: forgiving, tolerates neglect. Intermediate: some specific needs. Advanced: exacting requirements. Null if unclear."
        },
        "description": {
          "type": ["string", "null"],
          "description": "1–2 sentences describing the plant's character and key traits in plain English."
        },
        "placement": {
          "type": ["string", "null"],
          "enum": ["Indoor", "Outdoor", "Both", null],
          "description": "Where the plant thrives. Null if genuinely unclear."
        },
        "is_tropical": { "type": "boolean", "description": "True for tropical/subtropical species. Default false — never null." },
        "is_toxic_to_humans": { "type": "boolean", "description": "True if harmful to humans when ingested or on skin contact. Default false — never null." },
        "human_toxicity_notes": {
          "type": "string",
          "description": "Populated only when is_toxic_to_humans is true. Brief clinical note. Empty string when not applicable."
        },
        "produces_fruit": { "type": "boolean", "description": "True if plant produces fruit in typical cultivation. Default false — never null." },
        "fruit_season": {
          "type": "string",
          "description": "Populated only when produces_fruit is true. E.g. 'Late Summer – Autumn'. Empty string when not applicable."
        },
        "produces_flowers": { "type": "boolean", "description": "True if plant produces flowers in typical cultivation. Default false — never null." },
        "flowering_season": {
          "type": "string",
          "description": "Populated only when produces_flowers is true. Same format as fruit_season. Empty string when not applicable."
        },
        "growth_rate": {
          "type": ["string", "null"],
          "enum": ["Slow", "Moderate", "Fast", null],
          "description": "Typical cultivation growth rate."
        },
        "maintenance_level": {
          "type": ["string", "null"],
          "enum": ["Low", "Medium", "High", null],
          "description": "Weekly time investment. Low = tolerates neglect. High = frequent watering/misting."
        },
        "preferred_soil_type": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["Well-draining", "Sandy", "Loamy", "Clay", "Peaty", "Chalky", "Rich", "Poor", "Moisture-retaining"]
          },
          "description": "Applicable soil descriptors. Return [] if unknown."
        },
        "native_region": {
          "type": ["string", "null"],
          "description": "Geographic origin, e.g. 'Tropical West Africa'. Null if unclear."
        },
        "max_height_cm": {
          "type": ["integer", "null"],
          "minimum": 1,
          "description": "Mature height in cm in typical cultivation. Null if highly variable."
        },
        "max_spread_cm": {
          "type": ["integer", "null"],
          "minimum": 1,
          "description": "Mature lateral spread in cm. Null if highly variable."
        },
        "air_purifying": {
          "type": "boolean",
          "description": "True if documented to filter indoor VOCs per NASA Clean Air Study. Default false — never null."
        },
        "is_ai_enriched": { "type": "boolean", "const": true }
      },
      "required": ["scientific_name", "common_name", "ideal_min_ph", "ideal_max_ph", "is_toxic_to_pets", "toxicity_notes", "propagation_methods", "watering", "sunlight", "cycle", "check_depth_description", "ideal_humidity_min", "ideal_humidity_max", "care_difficulty", "description", "placement", "is_tropical", "is_toxic_to_humans", "human_toxicity_notes", "produces_fruit", "fruit_season", "produces_flowers", "flowering_season", "growth_rate", "maintenance_level", "preferred_soil_type", "native_region", "max_height_cm", "max_spread_cm", "air_purifying", "is_ai_enriched"]
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

### 🔌 2.3 Edge Function Response Shape

The `claude-plant-id` Edge Function wraps the Claude JSON output and appends two fields resolved from `cached_botanical_records`:

```ts
// Returned by POST /functions/v1/claude-plant-id on success (HTTP 200)
interface PlantIdResponse {
  is_plant_image: true;
  species_match: { common_name: string; scientific_name: string; confidence_score: number };
  alternative_candidates: Array<{ common_name: string; scientific_name: string; confidence_score: number }>;
  inat_taxon_id: number | null; // primary identifier — from cached_botanical_records; null when enrichment is still pending
  perenual_id: number | null;   // legacy — null for all species not previously fetched from Perenual; kept for backward compat
}

// Returned when the image does not show a plant (HTTP 400)
interface PlantIdError {
  error: string;
  error_code: 'INVALID_IMAGE';
}
```

`inat_taxon_id` is the primary species identifier as of Phase 3.16. Both fields are resolved from a `cached_botanical_records` lookup by `scientific_name` immediately after identification. If the species is not yet in cache, a minimal stub record is inserted so the background cron can enrich it — both IDs will be `null` in the response while enrichment is pending. The Angular client must handle this gracefully (e.g. show a toast and defer the detail panel).

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
