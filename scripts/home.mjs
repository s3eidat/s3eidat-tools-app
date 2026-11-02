/* Turn the site's hub page into the app home: drop website-only blocks, add favourites, swap in /_app/home.js.
   Every edit must find its marker; a changed hub page fails the build instead of shipping a half-edited home. */

const FAV_H2 = { en: "Favourites", ar: "المفضلة" };

function swap(html, find, replace, what) {
  const out = html.replace(find, replace);
  if (out === html) throw new Error(`app home: could not find ${what} in the hub page`);
  return out;
}

export function makeHome(hubHtml, lang = "en") {
  let h = hubHtml;
  h = swap(h, /\s*<section class="hub-ad"[\s\S]*?<\/section>/, "", "the promo video section");
  h = h.replace(/\s*<meta name="google-site-verification"[^>]*>/, ""); // English page only
  h = h.replace(/\s*<section class="hub-app"[\s\S]*?<\/section>/, ""); // "Get the app" card: you're already in it
  h = swap(h, '<link rel="stylesheet" href="/hub.css">', '<link rel="stylesheet" href="/hub.css">\n<link rel="stylesheet" href="/_app/home.css">', "the hub.css link");
  h = swap(h, /(\s*)<section id="recent"/, `$1<section id="favs" class="hub-recent" hidden>$1  <h2>${FAV_H2[lang]}</h2>$1  <div class="hub-recent-row" id="favs-row"></div>$1</section>$1<section id="recent"`, "the recent tools section");
  h = swap(h, '<script src="/hub.js"></script>', '<script src="/_app/home.js"></script>', "the hub.js script tag");
  return h;
}
