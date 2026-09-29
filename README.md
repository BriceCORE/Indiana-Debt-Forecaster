# Indiana School Debt Forecaster

A standalone CORE Construction dashboard for Indiana school debt and financing scenarios. Visitors do not need a ChatGPT account, a GitHub account, or any other login. The site runs entirely in the browser, with its data included in this folder.

## Publish with GitHub Pages

1. Create a new **public** GitHub repository, for example `indiana-debt-forecaster`. Enable **Add README** when creating it so the `main` branch exists.
2. Open the repository and choose **Add file → Upload files**. Upload the **contents of this folder**, including the `assets` folder. `index.html` and `site-data.json` must appear directly at the top of the repository, not inside another `indiana-debt-forecaster` folder. Extract the ZIP first; uploading the ZIP itself will not publish a working website.
3. Commit the uploaded files to `main`.
4. Open **Settings → Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**. Select **main** and **/(root)**, then click **Save**.
5. Wait for deployment to finish. The Pages settings will show **Visit site** and the public address, typically `https://YOUR-USERNAME.github.io/indiana-debt-forecaster/`.

Share the published website address with visitors. The repository address is the code page, not the dashboard. A GitHub account is only needed by the person managing the repository. GitHub Free supports Pages for public repositories.

The included `.nojekyll` file tells GitHub to serve the ready-made files. If your computer hides it during upload, create an empty file named `.nojekyll` in the repository using **Add file → Create new file**. No build command, package installation, API key, environment variable, or paid service is needed to publish this package.

Official instructions: [Create a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) and [configure publishing from a branch](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Included views

- **District detail** (`index.html`): district search, county browsing, Conservative/Base/Growth scenarios, start year, 10/15/20-year terms, level and wrapped structures, interactive debt charts, tax context, and obligation schedules.
- **Opportunity overview** (`overview.html`): statewide rankings, capacity and debt roll-off views, year and debt-lane filters, and links into the corresponding district and year.

Only Indiana is included. The original visual design and forecast calculations are retained, with a small table-layout correction for narrow screens. Other-state pages and links to the separately hosted Client Intelligence tool have been removed.

## Data included

This is the existing **September 17, 2026 model**, using the **September 15, 2026 debt snapshot**, with **290 Indiana districts**. The source snapshot contains 2,152 captured obligations: 2,077 parsed schedules and 75 missing schedules. The existing reconciliation labels and exclusions for incomplete schedules remain in place. The dashboard displays its source and model dates.

`site-data.json` is a saved snapshot, not a live feed. It includes the existing district records and model outputs and will be downloadable by anyone visiting the public site. Uploading this package does not refresh the financial data. The existing in-page model limitations and source links remain available.

## Update the site

Edit and upload changed HTML, JavaScript, CSS, or image files to `main`; GitHub Pages republishes after the commit. To update financial data, generate and review a new Indiana `site-data.json` through your existing data-preparation process, then upload it here. The original preparation process and multistate build are not needed to host this export and are not included.

`release.json` records the original data and forecast-code checksums. When intentionally changing the reviewed snapshot or calculation code, update those hashes and the snapshot information after review; otherwise the optional check command correctly reports that the saved release has changed.

## Preview locally (optional)

With Node.js 20 or newer installed, open a terminal in this folder and run:

```sh
npm start
```

Open `http://127.0.0.1:4173/`. No `npm install` is required. The preview also supports `http://127.0.0.1:4173/indiana-debt-forecaster/` to simulate a GitHub project address. Alternatively, run `python3 -m http.server 4173 --bind 127.0.0.1` in this folder.

Do not double-click `index.html` to preview it: browsers restrict loading the JSON data from a local `file://` address. Use the local web address above or the published GitHub Pages address.

## Optional checks

```sh
npm run check
```

This verifies the recorded data and forecast-code hashes, district coverage, required files, relative links, and absence of other-state or ChatGPT hosting dependencies in the pages. Browser checks are available in `test/browser-smoke.mjs`; they require Playwright and a Chromium browser, separately from the dependency-free site.

## Files to keep together

```text
index.html
overview.html
app.js
overview.js
styles.css
site-data.json
assets/
  core-logo-registered.png
  core-symbol.png
.nojekyll
```

These are the complete website. The README, release manifest, package file, scripts, and browser checks are maintenance helpers. All website paths are relative, so you can also upload the same website files to another static host or use a GitHub Pages custom domain.

## Troubleshooting

- **404 at the website address:** check that Pages publishes from `main` and `/(root)` and that `index.html` is at the repository root.
- **The dashboard says data could not load:** confirm `site-data.json` was uploaded next to `index.html`, then refresh.
- **Missing styling or logo:** upload `styles.css` and both images inside `assets`, preserving the names and capitalization.
- **Updates are not visible yet:** check the repository's **Actions** page for a failed or running Pages deployment. Deployment can take several minutes; then refresh the website.
