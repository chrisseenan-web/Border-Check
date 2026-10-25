# Border Check

A static website comparing NHS Scotland and NHS England on the evidence.
"Border Check" is a working name. Change it in each page's `<title>`, the
`site-name` meta tag and the header.

## How it works

Every number on the site lives in the `data` folder. The pages read those
files when they load, so you update a figure in one place and it changes on
every page, chart and share card.

| File | What it holds |
| --- | --- |
| `data/figures.csv` | The headline figures. One row per measure, with Scotland, England and North East values, periods, source link, how often it updates and when you last checked it. |
| `data/series.csv` | Trend points for the dashboard charts. Add a row for each new month or quarter. Values are plain numbers (no commas or % signs). |
| `data/myths.json` | The words for the six myths and the summary. Text in `{{figure_id.column}}` is filled from `figures.csv`. |
| `data/updates.csv` | The public change log. Add a row every time you update or correct something. |
| `data/releases.csv` | The publications you track and which figures each one updates. |

`figures.csv` opens in Excel or Google Sheets. Save it back as CSV (UTF-8).

## Fill in before launch

- Replace the England 18-week trend points marked "To do" in `updates.csv` with figures from the NHS England RTT overview timeseries.

## Preview on your computer

The pages load data files, so open them through a small local web server
rather than double-clicking:

```
cd site
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Publish on GitHub Pages (free)

1. Create a GitHub account and a new public repository, for example `border-check`.
2. Upload everything inside the `site` folder to the repository (drag and drop works on github.com).
3. In the repository, go to Settings, then Pages. Under "Build and deployment", choose "Deploy from a branch", pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/border-check/`.
5. Optional: buy a domain and add it under Settings, Pages, Custom domain.

Every time you commit a change to the data files, the live site updates within a minute or two. GitHub keeps the full history, which doubles as a public audit trail.

## Monthly update routine (about 30 minutes)

1. Open the **Updates** page on the live site. The release calendar shows "Check due" for publications that have probably released new figures.
2. For each one, open the publication, find the new figure and update the row in `figures.csv`. Change `last_checked` to today (YYYY-MM-DD).
3. For trend measures, add a new row to `series.csv` with the next `order` number.
4. Add a line to `updates.csv` saying what changed. Use type `Update`, `Correction`, `Clarification` or `To do`.
5. Run the checker: `python3 scripts/check_data.py`. It catches broken rows, missing sources and text that points at figures that don't exist.
6. Commit the changes. Download fresh share images from the myth pages if you're posting them.

If a new release changes the story (for example, a verdict no longer holds), update the wording in `myths.json` too, and say so in the change log.

## Share images

Each myth page and the overview page has a "Download share image" button. It draws a 1080 x 1350 PNG from the current data, ready for Instagram, LinkedIn or Facebook. It works on the published site; some preview environments block downloads.

## Structure

```
index.html        Overview, split result, myths, summary share card
myth.html         One page for all six myths (myth.html#m1 to #m6)
dashboard.html    Headline figures and trend charts
data.html         Every figure with filters, sources and methods
updates.html      Change log and release calendar
about.html        About, principles, corrections policy
assets/           Styles, charts and page logic
data/             The single source of truth
scripts/          Data checker
```

No build step, no framework, no tracking. Fonts come from Google Fonts and the share-image tool (html2canvas) from cdnjs.
