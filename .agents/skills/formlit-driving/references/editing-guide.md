# Editing guide: how the develop controls work, and how photographers use them

formlit's develop settings follow Lightroom Classic's panels, so Lightroom knowledge transfers directly. This guide maps that knowledge to formlit's ids and tools. Every statement comes from a cited source (the list is at the end, keys in brackets). A claim marked *single source* could not be confirmed by a second independent source: treat its numbers as a starting point to check with `analyze_photo` and `get_preview`, never as a rule.

## Contents

- The loop that works
- Tone (Basic panel)
- Presence
- Tone curve
- White balance
- Colour mixer
- Colour grading
- Calibration
- Black and white
- Detail
- Effects
- Profiles
- Masks
- Choosing a preset
- Sources

## The loop that works

1. `analyze_photo` on the photo as it is. Read `luminance`, `zones`, `clipping`, `cast` and `findings`.
2. Decide the intent with the person (natural, bright and airy, moody, film, black and white).
3. Propose: `analyze_photo` and `get_preview` both take `values` (and `preset` with `amount`) and render without saving. Compare the numbers before and after, then look at the preview.
4. Commit with `develop_set` (numbers), `develop_patch` (curve points, treatment, crop, masks) or `apply_preset`.
5. `analyze_photo` again. Stop when the findings that matter are gone and the preview reads right.

There is no single correct order: Adobe states it gives no recommended editing sequence [A-DEV]. Sources do agree on a few partial orders: choose the profile before moving sliders [A-PROF; LRQ-PROF], set white balance early [KELBY-BASIC], run AI Denoise early, before healing and masking [CHAN; A-ENH], and reduce noise before sharpening (*single source* [AP-SHARP]).

## Tone (Basic panel): `light.*`

| Control | What it does | Source |
| --- | --- | --- |
| `light.exposure` | In stops: +1.00 is about one stop brighter | [A-TONE] |
| `light.contrast` | Mainly the midtones: raises lighter-mid, darkens darker-mid | [A-TONE] |
| `light.highlights` | Left darkens bright areas and recovers blown detail | [A-TONE] |
| `light.shadows` | Right brightens shadows and recovers their detail | [A-TONE] |
| `light.whites` | Sets highlight clipping; a little clipping on speculars (metal, sun glints) is acceptable | [A-TONE] |
| `light.blacks` | Left maps more shadows to pure black; right reduces shadow clipping | [A-TONE] |

Adobe's tonal targets (as a share of the level range): Blacks 0 to 10 percent, Shadows 10 to 30, Exposure 30 to 70, Highlights 70 to 90, Whites 90 to 100 [A-TCA]. `analyze_photo` reports `zones` in exactly those bands, so you can see where the tones sit. Adobe's suggested order is Exposure, Highlights, Shadows, Whites, Blacks, Contrast, then touch up Exposure [A-TCA]; Scott Kelby sets Whites and Blacks before Exposure [KELBY-BASIC]. The sources disagree, so treat order as preference.

`auto_tone` maximises the tonal scale while minimising clipping [A-TONE]; it is a starting point, readjust Exposure after it [A-TCA].

## Presence: `effects.*`, `color.*`

- `effects.texture` works on medium-sized detail and leaves fine detail; `effects.clarity` is midtone-biased with a wider radius and changes luminance and saturation more [WENDT; KOST-TCD].
- Negative texture smooths skin while keeping pores and lashes; apply it locally to skin, not to beards or lips. Positive texture suits foliage and hair [WENDT; KOST-TCD]. In formlit use an AI people mask with parts `faceSkin` and `bodySkin` (or the `Smooth Skin` adaptive preset) instead of a global negative texture.
- For clarity, raise it until edge halos appear, then back off [A-TONE].
- `effects.dehaze`: right removes haze, left adds it, and it works locally [A-TONE; A-ACR-FX]. Heavy dehaze can make colours unrealistic (*single source* [PP-CTD]); it affects the lower histogram more than highlights, so check blacks afterwards (*single source* [KOST-TCD]).
- `color.saturation` is absolute and affects every colour equally; `color.vibrance` is relative, changes orange, red and yellow less, and avoids pushing already saturated colours to clipping [KOST-VS; PC-VS]. Prefer vibrance for portraits [PC-VS].

## Tone curve: `curve.*`

- Parametric regions: `curve.darks` and `curve.lights` mainly move the middle of the curve, `curve.shadows` and `curve.highlights` the ends; `curve.splitShadows`, `curve.splitMid`, `curve.splitHighlights` move the region boundaries [A-TONE; AP-CURVE].
- Point curves go through `develop_patch` as `{"curve": {"master": [[x, y], ...]}}` with x and y from 0 to 1; `red`, `green` and `blue` channels are separate [A-TONE; AP-CURVE].
- An S-curve (shadows down, highlights up) adds contrast and saturation (*single source* [AP-CURVE]).
- The matte or faded film look is made in the tone curve by raising the black point [DCW-FILM; FS-MATTE; EP-MATTE]. Real exported film presets use the curve 0,20 64,55 128,128 192,196 255,235 on a 0 to 255 scale, which is `[[0, 0.078], [0.251, 0.216], [0.5, 0.5], [0.753, 0.769], [1, 0.922]]` in formlit (*single source*: one repository of preset files [PEVA3]).
- Channel curves fix casts: lowering green adds magenta, lowering blue adds yellow, raising red adds red (*single source* [AP-CURVE]).

## White balance: `wb.temp`, `wb.tint`

- Temp runs blue to yellow, Tint green to magenta [A-CAST; DPT-WB]. Raw files take Temp 2000 to 50000 K and Tint -150 to +150 [KOST-WB].
- Neutralise from something that should be grey, not pure white or specular highlights [A-CAST; DPT-WB]. `auto_white_balance` is a starting point [A-CAST; DPT-WB].
- `analyze_photo` reports `cast` measured on near-neutral pixels only; a warm or cool reading in a sunset or a night scene may be the mood, not an error.
- Snow: cameras underexpose it, so add exposure; Auto white balance pulled back halfway beats the eyedropper on snow, which over-warms [PP-WINTER; AP-SNOW].
- Underwater: reds and oranges disappear first, so warm the image and move tint toward magenta; shift purples toward blue in the mixer [A-UNDERWATER; PL-UNDERWATER].
- Golden hour: fine-tune the existing warmth rather than removing it, lower highlights and lift shadows to balance sky and foreground (*single source* [A-GOLDEN]).

## Colour mixer: `mixer.[band].hue|sat|lum`

Bands: red, orange, yellow, green, aqua, blue, purple, magenta. Hue shifts a colour (a blue sky toward cyan or purple), Saturation sets its intensity, Luminance its brightness [A-MIXER; PP-HSL].

- **Skin** lives mainly in orange, with red and yellow [PP-HSL; DPT-SKIN]. Shift red and orange hue slightly toward red or pink and pull orange saturation back a little for natural skin [FS-SKIN; DPT-SKIN]; a small orange luminance increase brightens skin [DPT-SKIN]. `analyze_photo` `bands.orange` shows how much orange there is and how saturated.
- **Sky and water**: blue and aqua [PP-HSL; A-MIXER]. Darker, richer sky: blue luminance down, saturation up.
- **Foliage**: green and yellow are linked; a drag on grass moves green and aqua [PP-HSL]. Autumn looks shift green and yellow toward orange.

## Colour grading: `grading.*`

- Shadows, midtones and highlights each take a hue (0 to 359), a saturation and a luminance; global tints the whole image [KOST-CG; WAIDER].
- `grading.blending` sets how much the three ranges overlap: low keeps each tint pure, high mixes them [KOST-CG; A-WHATSNEW]. Blending 100 with only the shadow and highlight wheels reproduces classic split toning [A-WHATSNEW; KELBY-SPLIT].
- `grading.balance` moves the split between ranges: negative extends the shadow tint, positive the highlight tint [KOST-CG; A-WHATSNEW]. Blending and balance do not affect global (*single source* [KOST-CG]).
- **Warm highlights, cool shadows**: highlights near hue 40 at saturation 10 to 15, shadows near 200 to 220 at 10 to 15, midtones untouched (*single source* [PC-CG]).
- **Teal and orange**: teal or blue shadows with orange highlights [COLLIER; CHILDRESS; PP-TEAL]. A real exported preset uses shadows 209 at 20, highlights 36 at 15, blending 75, balance -30 (*single source* [PEVA3]). Calibration can strengthen it: red primary hue up, blue primary hue down [COLLIER; EP-TEAL].
- **How strong**: across real exported presets, grading saturation stays between about 7 and 20 [PEVA3], and wheel saturation above about 20 to 25 makes the cast obvious (*single source* [PC-CG]). Start at 8 to 15.
- Moody: shadows near 220 at 12 to 15, highlights near 40 at 5 to 8; pastel: shadows near 270 at 8 to 12, highlights near 25 at 8 to 10 (*single source* [PC-CG]).

## Calibration: `calibration.*`

Shadows tint plus red, green and blue primary hue and saturation; the primaries change every colour that contains them, unlike the mixer [PHOTOFOCUS; LENSVID]. Use hue rarely and in small amounts [PHOTOFOCUS; BENZ]. Raising blue primary saturation enriches colour but over-saturates skies easily; offset with the blue and aqua mixer bands [BENZ; KELBYONE-CAL].

## Black and white: `treatment`, `bw.*`

- Convert with `develop_patch` `{"treatment": "bw"}` (or a B&W preset); each `bw.[band]` then sets how bright that original colour renders in grey [A-BW; PHOTOCRATI].
- Darken a blue sky with `bw.blue` negative; Adobe's tutorial uses about -20 for sky and sea [A-BW; PHOTOCRATI]. Set white balance first so colours separate [PHOTOCRATI].
- A real Tri-X style preset uses contrast +35, blacks -30, mix red +30 orange +20 green -25 blue -40, grain 55 (*single source* [PEVA3]); a low-key B&W portrait: exposure -0.45, contrast +47, highlights -100, whites +48, blacks +42, shadows +26, grain 25 (*single source* [DCW-LOWKEY]).
- Street black and white wants a full range from brightest whites to darkest blacks, without forcing contrast the light did not give (*single source* [PP-STREET]).

## Detail: `detail.*`

- Sharpening: Amount is edge strength, Radius the size of detail (large radii look unnatural), Detail low removes edge blur and high emphasises texture, Masking 0 sharpens everywhere and 100 only strong edges [A-RETOUCH; KELBY-SHARP]. Keep radius around 1.0, rarely above 1.3 (*single source* [KELBY-SHARP]). For portraits use high masking so skin is not sharpened.
- Noise: `detail.nrLuminance` reduces grey grain, its Detail keeps more detail at the cost of noise; `detail.nrColor` reduces colour noise [A-RETOUCH]. Judge at 1:1.
- AI Denoise (`denoise`) writes a new DNG with the noise sliders at zero, works on Bayer and X-Trans raws, and should run before masks and retouching; results can look too smooth, which a little grain hides [CHAN; RINGSMUTH]. `analyze_photo` flags ISO 3200 and up.

## Effects: `vignette.*`, `grain.*`

- Vignette amount negative darkens the corners; midpoint confines it to the corners as it rises; roundness and feather shape and soften it [A-ACR-FX; KOST-FX; DCW-VIG]. It follows the crop; for an off-centre vignette use a radial gradient mask (*single source* [DCW-VIG]).
- Grain: amount (0 is off), size (25 or more starts to blur), roughness (lower is more even) (size note *single source* [A-ACR-FX]). Film looks use grain about 25 to 35 [DCW-FILM; DCW-VINTAGE].

## Profiles: `profile.id`, `profile.amount`

Applying a profile changes the starting rendering, not the slider values; choose it first [A-PROF; LRQ-PROF]. Creative profiles take an amount up to 200 [A-PROF; A-TONE]. formlit's ids: `fl.color` (default), `fl.neutral`, `fl.vivid`, `fl.landscape`, `fl.portrait`, `fl.monochrome`, `fl.creative.warmfade`, `fl.creative.coolmatte`, `fl.creative.tealorange`, `fl.creative.golden`, `fl.creative.muted`, `fl.bw.punch`, `fl.bw.soft`, `fl.bw.redfilter`, `fl.bw.cooltone`, plus camera-matching styles for raws from `develop.info`.

## Masks: `add_ai_mask`, `add_gradient_mask`

AI masks for subject, sky, background, objects and people, people parts (face skin, body skin, eyebrows, eye sclera, iris and pupil, lips, teeth, hair, clothes) and landscape parts (sky, water, vegetation, mountains, architecture, natural and artificial ground), plus linear and radial gradients and colour, luminance and depth ranges [A-MASK; A-PORTRAIT]. Adobe's portrait tutorial: darker eyebrows, brighter sclera, more saturation and contrast on lips, smoother facial skin (*single source* [A-PORTRAIT]). Local work beats global: darken a sky with a sky mask instead of lowering global exposure.

## Choosing a preset

`list_presets` with a `query` ("moody forest", "portrait warm", "bw street", "snow") returns presets with a description of what each does. Preview with `get_preview` or `analyze_photo` and `preset` before `apply_preset`, and use `amount` (50 to 80 is often enough). Presets that touch `light.*` replace the photo's basic tone; apply them before fine-tuning exposure, then correct with `develop_set` `delta: true`.

## Sources

| Key | Source |
| --- | --- |
| A-TONE | Adobe, Work with image tone and color, helpx.adobe.com/lightroom-classic/help/image-tone-color.html |
| A-TCA | Adobe, Tone Control Adjustment in Lightroom Classic and Adobe Camera Raw, helpx.adobe.com/lightroom-classic/help/tone-control-adjustment.html |
| A-DEV | Adobe, Develop module basics, helpx.adobe.com/lightroom-classic/desktop/process-and-develop-photos/develop-module-tools.html |
| A-RETOUCH | Adobe, Retouch photos, helpx.adobe.com/lightroom-classic/desktop/process-and-develop-photos/retouch-photos.html |
| A-ENH | Adobe, Improve image quality using Enhance, helpx.adobe.com/lightroom-classic/desktop/process-and-develop-photos/enhance-details.html |
| A-MASK | Adobe, Masking tool, helpx.adobe.com/lightroom-classic/desktop/process-and-develop-photos/masking.html |
| A-ACR-FX | Adobe, Vignette, grain, and dehaze effects in Camera Raw, helpx.adobe.com/camera-raw/desktop/edit-and-enhance-images/tone-and-color/vignette-grain-effects-camera-raw.html |
| A-PROF | Adobe, Adjust color rendering in Camera Raw, helpx.adobe.com/camera-raw/desktop/edit-and-enhance-images/tone-and-color/adjust-color-rendering-camera-camera.html |
| A-MIXER | Adobe, Edit your images with Color Mixer tool, helpx.adobe.com/uk/lightroom-classic/desktop/process-and-develop-photos/color-mixer.html |
| A-WHATSNEW | Adobe, Feature summary, Lightroom Classic October 2020, helpx.adobe.com/lightroom-classic/help/whats-new/2021.html |
| A-CAST | Adobe Learn, Remove color cast, adobe.com/learn/lightroom-cc/web/remove-color-cast |
| A-BW | Adobe Learn, Use presets to convert color photos to black and white, adobe.com/learn/lightroom-classic/web/convert-photo-black-white |
| A-PORTRAIT | Adobe Learn, AI portrait mask, adobe.com/learn/lightroom-cc/web/ai-portrait-mask-lightroom |
| A-UNDERWATER | Adobe Learn (Aliah Banchik), Underwater photo editing, adobe.com/learn/lightroom-cc/web/underwater-photo-editing |
| A-GOLDEN | Adobe, Golden hour photography, adobe.com/in/creativecloud/photography/discover/golden-hour.html |
| WENDT | Max Wendt (Adobe Camera Raw team), Introducing the Texture Control, blog.adobe.com/en/publish/2019/05/14/from-the-acr-team-introducing-the-texture-control |
| CHAN | Eric Chan (Adobe), Denoise demystified, blog.adobe.com/en/publish/2023/04/18/denoise-demystified |
| KOST-CG | Julieanne Kost (Adobe), Color Grading in Lightroom Classic, jkost.com/blog/?p=18167 |
| KOST-TCD | Julieanne Kost, Enhancing Texture, Clarity and Dehaze in Lightroom Classic, jkost.com/blog/2022/03/texture-clarity-and-dehaze-in-lightroom-classic.html |
| KOST-VS | Julieanne Kost, The Difference Between the Vibrance and Saturation Sliders, jkost.com/blog/?p=21196 |
| KOST-WB | Julieanne Kost, Six favorite white balance shortcuts, jkost.com/blog/?p=19784 |
| KOST-FX | Julieanne Kost, Adding Vignette and Grain Effects in Lightroom Classic, jkost.com/blog/2024/08/adding-vignette-and-grain-effects-in-lightroom-classic.html |
| LRQ-PROF | Victoria Bampton, Camera profiles, lightroomqueen.com/camera-profiles/ |
| KELBY-BASIC | Scott Kelby, Lightroom's Editing Essentials, insider.kelbyone.com/lightrooms-editing-essentials-how-i-use-the-basic-panel-in-my-own-editing/ |
| KELBY-SPLIT | Scott Kelby, Split toning in the Color Grading panel, lightroomkillertips.com/how-to-do-regular-ol-split-toning-in-lightrooms-new-color-grading-panel/ |
| KELBY-SHARP | Scott Kelby, Tips for Sharpening and Noise Reduction in Lightroom, rockynook.com/articles/tips-for-sharpening-and-noise-reduction-in-lightroom/ |
| KELBYONE-CAL | Jessica Maldonado, Introduction to the Calibration Panel, insider.kelbyone.com |
| WAIDER | Jan Erik Waider, The New Color Grading Tool in Lightroom Classic, northlandscapes.com |
| AP-CURVE | Amateur Photographer, Lightroom tips: tonal curve, amateurphotographer.com/technique/lightroom-tips-tonal-curve/ |
| AP-SHARP | James Paterson, Amateur Photographer, Lightroom tips: sharpening and noise reduction |
| AP-SNOW | Martin Evening, Amateur Photographer, How to edit a snowy scene |
| PP-CTD | PetaPixel, Understanding the Differences Between Clarity, Texture, and Dehaze (2021) |
| PP-HSL | PetaPixel, How to Color Your Photos Using the HSL Tool in Lightroom (2017) |
| PP-TEAL | PetaPixel, Orange and teal look (2017) |
| PP-WINTER | Mark Denney, PetaPixel, 7 Lightroom tips to transform your winter photos (2019) |
| PP-STREET | PetaPixel / COOPH, 7 tips for better black and white street photography (2020) |
| FS-SKIN | Alex Cooke, Fstoppers, How to Edit Portrait Skin Tones in Lightroom |
| FS-MATTE | Trevor Dayley, Fstoppers, How to create the popular matte look in Lightroom |
| DCW-FILM | Sean McCormack, Digital Camera World, Bring back the film look in Lightroom |
| DCW-VINTAGE | Sean McCormack, Digital Camera World, Create a vintage-looking portrait |
| DCW-LOWKEY | Sean McCormack, Digital Camera World, Edit and retouch a low-key portrait |
| DCW-VIG | Sean McCormack, Digital Camera World, Draw viewers' attention with a vignette |
| PC-CG | Jon Phillips, PictureCorrect, A Beginner's Guide to Color Grading Your Photos |
| PC-VS | Dawn Gilfillan, PictureCorrect, Vibrance vs. Saturation in Lightroom |
| DPT-SKIN | Jon C. Phillips, Daily Photo Tips, How to Get Natural Skin Tones in Lightroom |
| DPT-WB | Jon C. Phillips, Daily Photo Tips, White Balance in Lightroom |
| COLLIER | Jeff Collier, Shotkit, Teal and Orange Look |
| CHILDRESS | Andrew Childress, Envato Tuts+, The orange and teal look in Lightroom Classic |
| EP-TEAL | Expert Photography, How to Get the Teal and Orange Effect in Lightroom |
| EP-MATTE | Expert Photography, How to Create a Cool Matte Photo Effect in Lightroom |
| PHOTOFOCUS | Photofocus, Camera calibration in Lightroom and Adobe Camera Raw |
| LENSVID | Iddo Genuth, LensVid, 5 Ways to Use the Color Calibration Tool in Adobe Camera RAW |
| BENZ | Greg Benz, Extract insane color from RAW files with camera calibration |
| PHOTOCRATI | Chris Christoff, Photocrati, Intro to Digital B&W with Lightroom |
| RINGSMUTH | Simon Ringsmuth, Digital Photography School, Lightroom's AI-Powered Denoise Tool |
| PL-UNDERWATER | Photography Life, How to edit underwater photos |
| PEVA3 | peva3/Lightroom-Presets (MIT), real .xmp preset files: Cinematic Teal and Orange, Matte Fade, Moody PNW, Kodak Portra 400, Kodak Tri-X 400, github.com/peva3/Lightroom-Presets. One repository, likely tool-assisted, so its values are one author's design choices |
