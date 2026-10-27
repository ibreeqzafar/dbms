# Furniture extraction and recommendation update

The studio prepares a transparent furniture cutout before placing it over the user's room photograph. The original product-photo background is not silently placed in the room. A focus crop lets the user isolate one item when the source includes several pieces. A failed extraction produces a retry message instead of an apparently finished composition.

Inference uses ONNX Runtime Web 1.22.0 and the 4.4 MB U-2-Netp model, pinned to model revision `7112208dbac3a3642496c8d54e2f0f9bb3dc1dc8`. Processing runs in a Web Worker on the user's device, with one WASM thread, so it does not require cross-origin isolation or a paid inference API. Model and runtime assets download on first use. Room photographs are never sent to Hugging Face, jsDelivr or a background-removal service.

The model detects foreground objects, not a guaranteed semantic instance of the named furniture. Busy scenes, occlusion, transparent glass and fine details can need a tighter focus selection. The composition remains a 2D preview, not a room scan or measurement guarantee.

Images with CORS support are processed directly. Older catalogue hosts can use the existing authenticated room-assets function's product-image route. It accepts only an active catalogue slug, looks up the approved image URL itself, checks each redirect against exact permitted hosts, excludes private storage URLs, restricts MIME types and stops after 15 MB. It does not accept user-supplied fetch URLs, expose service keys or change private room-asset ownership checks.

Recommendations now support furniture categories and balanced/newest/budget priorities. Selecting a category explicitly searches across rooms; leaving it blank keeps the chosen room constraint. Budget, quantity, stock, style, colour and supplied measurement checks still apply. Matching is preference-based; the uploaded room photo is not semantically analysed. The existing server generation limits remain in force.

## Open-source credits

- [ONNX Runtime](https://github.com/microsoft/onnxruntime), MIT licence.
- [U-2-Net](https://github.com/xuebinqin/U-2-Net), Apache-2.0 licence, by Xuebin Qin and contributors.
- [BritishWerewolf/U-2-Netp ONNX conversion](https://huggingface.co/BritishWerewolf/U-2-Netp), Apache-2.0 licence.

No n8n workflow or AI-provider credential is embedded in this implementation. Those integrations remain a separate setup step.
