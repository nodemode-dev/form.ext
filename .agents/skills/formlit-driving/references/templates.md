# formlit built-in templates

Generated from formlit's template library; do not edit by hand. `list_templates` returns the same with a `query`; `apply_template` applies one by id or name; `setup_shoot` runs a whole shoot recipe.

Metadata placeholders: {creator} {email} {url} (remembered after the first use), {client} {event} {job} (per call), {year} (this year). A field whose placeholder has no value is skipped.

## Contents

- Shoot recipes
- Export presets
- Filename templates
- Folder templates
- Metadata templates
- Keyword sets
- Intelligent collection templates

## Shoot recipes

| Recipe | What it sets | Naming, metadata, keywords | Exports | Workflow prompt |
| --- | --- | --- | --- | --- |
| Wedding (`wedding`) | Time-sorted names across bodies, personal-use licence, the wedding keyword set, noise by ISO for the reception, and gallery plus print exports. Noise by ISO at import. | year-day-shoot, multicam, wedding-client, wedding | builtin.client-gallery, builtin.print-lab, builtin.proof | wedding_event_workflow |
| Portrait Session (`portrait`) | Client naming, all-rights copyright, the portrait keyword set and proof plus print exports. | year-day-shoot, client-date-seq, all-rights, portrait | builtin.proof, builtin.client-gallery, builtin.print-lab | portrait_session_workflow |
| Corporate Headshots (`headshots`) | Client naming, commercial licence and web plus full-size exports for a company's people pages. | clients, client-date-seq, commercial, portrait | builtin.client-gallery, builtin.full | portrait_session_workflow |
| Event and Conference (`event`) | Time-sorted multi-camera names, event metadata, the event keyword set and fast web delivery. Noise by ISO at import. | year-day-shoot, multicam, event, event | builtin.web, builtin.client-gallery | wedding_event_workflow |
| News and Sports (`news-sports`) | Wire naming, editorial IPTC, embedded previews for speed and full-size filing with all metadata. Only standard toning and cropping are allowed. Noise by ISO at import. | day, wire, editorial, sports | builtin.news | news_sports_workflow |
| Landscape and Travel (`landscape`) | Date and shoot folders, all-rights copyright, the landscape keyword set, portfolio and print exports. | year-day-shoot, date-seq, all-rights, landscape | builtin.web, builtin.4k, builtin.print-lab | landscape_workflow |
| Real Estate Listing (`real-estate`) | Listing-order names, a listing licence, the real estate keyword set and MLS plus web exports. | clients, listing-seq, real-estate, real-estate | builtin.mls, builtin.web | real_estate_workflow |
| Product and E-commerce (`product`) | SKU naming, commercial licence, the product keyword set and shop plus full-size exports. | clients, product-sku, commercial, product | builtin.web, builtin.full | product_workflow |
| Concert and Low Light (`concert`) | Time-sorted names, event metadata, the concert keyword set, noise by ISO and web delivery. Noise by ISO at import. | year-day-shoot, multicam, event, concert | builtin.web, builtin.client-gallery | concert_workflow |
| Stock Submission (`stock`) | Date naming, stock metadata and a full-size sRGB JPEG export that meets the agencies' 4 MP minimum. | year-day-shoot, date-seq, stock, travel | builtin.stock | stock_workflow |
| Family and Newborn (`family`) | Client naming, personal-use licence, the family keyword set and gallery plus print exports. | year-day-shoot, client-date-seq, wedding-client, family | builtin.client-gallery, builtin.print-lab | portrait_session_workflow |
| Night Sky (`astro`) | Date and shoot folders, the night sky keyword set, noise by ISO and 4K plus print exports. Noise by ISO at import. | year-day-shoot, datetime-num, all-rights, astro | builtin.4k, builtin.print-lab | astro_workflow |

## Export presets

| Preset | Group | What it is for |
| --- | --- | --- |
| JPEG for Web (2048 px) (`builtin.web`) | General |  |
| Full Size JPEG (`builtin.full`) | General |  |
| For Email (1200 px) (`builtin.email`) | General |  |
| 16-bit TIFF, ProPhoto RGB (`builtin.tiff`) | General |  |
| Print, 300 ppi Adobe RGB (`builtin.print`) | General |  |
| Original Files (`builtin.original`) | General |  |
| DNG with Edits (`builtin.dng`) | General |  |
| Ultra HDR JPEG (gain map) (`builtin.hdr`) | General |  |
| Client Gallery (2048 px, signed) (`builtin.client-gallery`) | Client Delivery | Online gallery size with a small copyright mark bottom right and the copyright in the file. |
| Proofs (1200 px, centred watermark) (`builtin.proof`) | Client Delivery | Small proofs for choosing, with a large faint watermark across the middle so they cannot stand in for the finals. |
| Print Lab (sRGB JPEG, 300 ppi) (`builtin.print-lab`) | Print | Full size, high-quality sRGB JPEG for consumer and pro labs (Mpix asks for sRGB; Bay Photo and WHCC also take Adobe RGB; WHCC prints most products at 300 dpi, Mpix and Bay Photo size at 250). |
| Stock Agency (sRGB JPEG, full size) (`builtin.stock`) | Licensing | Full-size sRGB JPEG with all metadata; Adobe Stock and Shutterstock both ask for JPEG in sRGB of at least 4 MP, so do not crop below that. |
| News Filing (JPEG, full metadata) (`builtin.news`) | Licensing | Full-size JPEG that keeps every IPTC field (caption, creator, credit, location) for a picture desk. |
| Real Estate MLS (3000 px, under 6 MB) (`builtin.mls`) | Web and Social | sRGB JPEG with the long side at 3000 px and each file under 6 MB. MLS rules vary (Canopy MLS caps at 3000 x 3000 and 6 MB; Canopy and Unlock MLS both ask for at least 2048 x 1536), so check yours. |
| Instagram (1080 px wide) (`builtin.instagram`) | Web and Social | 1080 px wide sRGB JPEG; Instagram's help says it keeps photos up to 1080 px across. Crop to 4:5 portrait or 1:1 first if you want them to fill the feed. |
| Blog and Website (1600 px) (`builtin.blog`) | Web and Social | 1600 px long side, lighter file for web pages. |
| 4K Display (3840 px) (`builtin.4k`) | Web and Social | 3840 px long side for 4K screens, slideshows and portfolio sites. |
| Archive Master (16-bit TIFF, Adobe RGB) (`builtin.archive`) | Print | Lossless 16-bit TIFF in Adobe RGB with all metadata, for a finished master to keep. |

## Filename templates

| Template | Pattern | Use |
| --- | --- | --- |
| Filename (unchanged) (`filename`) | `{name}` | Keeps the camera's file name. |
| Name - Sequence (`custom-seq`) | `{custom}-{seq:3}` | Shoot or client name plus a three-digit count; the usual delivery naming. |
| Name - Camera Frame Number (`custom-num`) | `{custom}-{num}` | Custom name plus the camera's own frame number, so names still trace back to the card. |
| Date - Camera Name (`date-filename`) | `{date:%Y%m%d}-{name}` | Capture date in front of the camera name; sorts by day in any file browser. |
| Date - Sequence (`date-seq`) | `{date:%Y-%m-%d}-{seq:4}` | Capture date and a four-digit count. |
| Date and Time - Original Number (`datetime-num`) | `{date:%Y%m%d_%H%M%S}_{num}` | Capture time to the second plus the frame number; unique even for bursts. |
| Shoot Name - Filename (`shoot-filename`) | `{custom}-{name}` | Shoot name in front of the camera name. |
| Client_Date_Sequence (`client-date-seq`) | `{custom}_{date:%Y%m%d}_{seq:4}` | Client or job, capture date and count; a common studio delivery pattern. |
| Creator_Date_Sequence (`creator-date-seq`) | `{creator}_{date:%Y%m%d}_{seq:4}` | Photographer, date and count; needs a creator in the metadata (a metadata template at import sets it). |
| Time-sorted Multi-camera (`multicam`) | `{date:%Y%m%d-%H%M%S}-{camera}-{num}` | Capture time first, then body and frame: files from several cameras interleave in shooting order. Set every camera's clock to the same time before the shoot. |
| Wire: Date_Creator_Sequence (`wire`) | `{date:%Y%m%d}_{creator}_{seq:3}` | Date, photographer and count for news and sports filing; needs a creator in the metadata. |
| Listing - Sequence (`listing-seq`) | `{custom}-{seq:2}` | Property address or listing id as the custom text and a two-digit order, the order the listing shows them. |
| SKU - Sequence (`product-sku`) | `{custom}_{seq:2}` | Product SKU as the custom text and a view number (01 front, 02 back and so on). |
| City_Date_Sequence (`city-date-seq`) | `{city}_{date:%Y%m%d}_{seq:3}` | City from the metadata, date and count; for travel work. |
| Title - Sequence (`title-seq`) | `{title}-{seq:2}` | Title from the metadata and a count; for portfolio and print files. |
| Folder - Sequence (`folder-seq`) | `{folder}-{seq:4}` | The folder's name and a count. |
| Rating - Filename (`rating-filename`) | `{rating}star-{name}` | Star rating in front of the name, so selects sort to the top. |

## Folder templates

| Template | Pattern | Use |
| --- | --- | --- |
| By date: 2026/2026-10-07 (`year-day`) | `{date:%Y}/{date:%Y-%m-%d}` | Year, then one folder per day. |
| By date: 2026/10 (`year-month`) | `{date:%Y}/{date:%m}` | Year, then month. |
| By date: 2026-10-07 (`day`) | `{date:%Y-%m-%d}` | One folder per day. |
| Year / Date Shoot Name (`year-day-shoot`) | `{date:%Y}/{date:%Y-%m-%d} {custom}` | Year, then a job folder that starts with the date so jobs sort in order (the custom text is the shoot name). |
| Year / Shoot Name (`year-shoot`) | `{date:%Y}/{custom}` | Year, then the shoot name. |
| Clients / Client / Date (`clients`) | `Clients/{custom}/{date:%Y-%m-%d}` | A folder per client (the custom text), then per day. |
| By camera: Camera / Date (`camera-day`) | `{camera}/{date:%Y-%m-%d}` | One folder per body, then per day; keeps a second shooter's cards apart. |
| Into one folder (`one`) | `(none)` | Everything into the destination folder. |

## Metadata templates

| Template | Fields | Use |
| --- | --- | --- |
| Copyright: All Rights Reserved (`all-rights`) | creator, copyright, copyrightStatus, rightsUsage, creatorEmail, creatorUrl | Creator, copyright notice, status and usage terms; the default for anything that leaves the studio. |
| Creative Commons CC BY 4.0 (`cc-by`) | creator, copyright, copyrightStatus, rightsUsage, copyrightUrl | Marks the photos as licensed under CC BY 4.0 and links the licence deed. |
| Creative Commons CC BY-SA 4.0 (`cc-by-sa`) | creator, copyright, copyrightStatus, rightsUsage, copyrightUrl | Marks the photos as licensed under CC BY-SA 4.0 and links the licence deed. |
| Creative Commons CC BY-ND 4.0 (`cc-by-nd`) | creator, copyright, copyrightStatus, rightsUsage, copyrightUrl | Marks the photos as licensed under CC BY-ND 4.0 and links the licence deed. |
| Creative Commons CC BY-NC 4.0 (`cc-by-nc`) | creator, copyright, copyrightStatus, rightsUsage, copyrightUrl | Marks the photos as licensed under CC BY-NC 4.0 and links the licence deed. |
| Creative Commons CC BY-NC-SA 4.0 (`cc-by-nc-sa`) | creator, copyright, copyrightStatus, rightsUsage, copyrightUrl | Marks the photos as licensed under CC BY-NC-SA 4.0 and links the licence deed. |
| Creative Commons CC BY-NC-ND 4.0 (`cc-by-nc-nd`) | creator, copyright, copyrightStatus, rightsUsage, copyrightUrl | Marks the photos as licensed under CC BY-NC-ND 4.0 and links the licence deed. |
| Public Domain (CC0 1.0) (`cc0`) | creator, copyrightStatus, rightsUsage, copyrightUrl | Dedicates the photos to the public domain under CC0 1.0. |
| Editorial and News (`editorial`) | creator, creatorJob, copyright, copyrightStatus, credit, source, instructions, jobId | IPTC fields a picture desk reads: creator, job title, credit line, source, instructions and job id. Write the caption per photo. |
| Wedding Client Delivery (`wedding-client`) | creator, copyright, copyrightStatus, event, rightsUsage, creatorUrl | Copyright with a personal-use licence for a couple's gallery, and the event name. |
| Commercial Client Licence (`commercial`) | creator, copyright, copyrightStatus, rightsUsage, instructions, creatorEmail | Copyright with usage limited to the client's contract. |
| Real Estate Listing (`real-estate`) | creator, copyright, copyrightStatus, credit, rightsUsage | Copyright with usage limited to marketing the listing. |
| Event Coverage (`event`) | creator, copyright, copyrightStatus, event, credit | Creator, copyright, credit line and the event name. |
| Portfolio and Web (`portfolio`) | creator, copyright, copyrightStatus, creatorUrl, rightsUsage | Copyright and a link back for photos posted online. |
| Stock Submission (`stock`) | creator, copyright, copyrightStatus | Creator and copyright only; agencies take title, description and keywords from their own upload form or the photo's Title, Caption and Keywords. |
| Clear Rights Fields (`clear-rights`) | copyright, copyrightStatus, rightsUsage, copyrightUrl | Empties copyright, status, usage terms and the licence link. |

## Keyword sets

| Set | Keywords |
| --- | --- |
| Outdoor Photography (`landscape`) | Landscape, Wildlife, Macro, Sunset, Mountains, Forest, Water, Sky, Snow |
| Portrait Photography (`portrait`) | Portrait, Headshot, Family, Couple, Children, Group, Studio, Natural Light, Black and White |
| Wedding Photography (`wedding`) | Ceremony, Reception, Getting Ready, Details, Bride, Groom, Family, First Dance, Candid |
| Event Photography (`event`) | Stage, Speaker, Audience, Venue, Candid, Group, Details, Food, Signage |
| Sports Photography (`sports`) | Sports, Action, Celebration, Team, Coach, Fans, Warm-up, Podium, Venue |
| Real Estate Photography (`real-estate`) | Exterior, Front, Kitchen, Living Room, Bedroom, Bathroom, Backyard, Twilight, Aerial |
| Product Photography (`product`) | Product, Hero, Front, Back, Detail, Lifestyle, White Background, Packaging, Scale |
| Food Photography (`food`) | Food, Dish, Overhead, Drinks, Dessert, Ingredients, Kitchen, Restaurant, Table |
| Travel Photography (`travel`) | Travel, City, Street, Architecture, Market, People, Landmark, Food, Transport |
| Street Photography (`street`) | Street, Documentary, People, Night, Shadows, Reflections, Crowd, Signs, Black and White |
| Wildlife Photography (`wildlife`) | Wildlife, Birds, Mammals, In Flight, Behaviour, Habitat, Portrait, Feeding, Young |
| Family Photography (`family`) | Family, Newborn, Kids, Parents, Siblings, Home, Lifestyle, Milestone, Pets |
| Concert Photography (`concert`) | Concert, Live Music, Stage, Singer, Guitar, Drums, Crowd, Lights, Backstage |
| Architecture Photography (`architecture`) | Architecture, Exterior, Interior, Facade, Detail, Stairs, Lines, Night, Skyline |
| Night Sky Photography (`astro`) | Night Sky, Milky Way, Stars, Star Trails, Aurora, Moon, Long Exposure, Dark Sky, Nightscape |

## Intelligent collection templates

| Template | Rules | Use |
| --- | --- | --- |
| Red Label (`colored-red`) | label = red | Photos with the red label. |
| Top Rated (`five-stars`) | rating = 5 | Five-star photos. |
| Four Stars and Up (`four-plus`) | rating >= 4 | Four and five stars: portfolio candidates. |
| Taken in the Last 30 Days (`past-month`) | captureTime inLast 30 | Taken in the last 30 days. |
| Edited in the Last Two Days (`recently-modified`) | editTime inLast 2 | Edited in the last two days. |
| Imported This Week (`imported-week`) | importTime inLast 7 | Imported in the last 7 days. |
| No Keywords Yet (`without-keywords`) | keyword notContains | Photos with no keywords yet. |
| Without Copyright (`no-copyright`) | copyright isEmpty | Photos missing a copyright notice; apply a metadata template before delivery. |
| Without GPS (`missing-gps`) | hasGps = False | Photos with no location. |
| Picks to Edit (`picks-to-edit`) | flag = pick; edited = False | Picked but not developed yet. |
| Ready to Deliver (`ready`) | flag = pick; edited = True | Picked and developed. |
| Unrated Picks (`unrated-picks`) | flag = pick; rating = 0 | Picks that still need stars. |
| Rejects (`rejects`) | flag = reject | Rejected photos, to review before removing. |
| Possibly Soft (`soft`) | sharpness < 35 | Sharpness score under 35 after analyze culling. |
| Best of Each Group (`best-of-group`) | bestOfGroup = True | The sharpest frame of each group of near-duplicates, after analyze culling. |
| High ISO (3200+) (`high-iso`) | iso >= 3200 | ISO 3200 and up: candidates for noise reduction by ISO or Denoise. |
| Long Exposures (1 s+) (`long-exposure`) | shutter >= 1 | Shutter of a second or longer. |
| Telephoto (200 mm+) (`telephoto`) | focal >= 200 | Focal length 200 mm and longer. |
| Wide Angle (24 mm and wider) (`wide`) | focal <= 24 | Focal length 24 mm or wider. |
| Raw, Not Edited (`raw-unedited`) | kind = raw; edited = False | Raw files with no develop settings yet. |
| Videos (`videos`) | kind = video | Every video clip. |
| Virtual Copies (`virtual-copies`) | virtualCopy = True | Versions made as virtual copies. |
| Missing Files (`missing-files`) | missing = True | Photos whose original cannot be found. |
