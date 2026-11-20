# forkcommons.org

The website for Fork Commons: free, open-source software for town halls, local newsrooms, public media and shared workshops, held in trust for the public.

[Website](https://forkcommons.org) · [Fork Commons on GitHub](https://github.com/forkcommons) · [TownLight on GitHub](https://github.com/townlight)

## How the site is built

The pages at the root of this repository are generated. Do not edit them by hand.

- `site/data/products.json` lists every program, product, core component and workshop tool, with its status and links.
- `site/src/build.ts` turns that list into the HTML pages. `site/src/styles.css` is the design system.
- `data/site-inventory.json` records where each repository's own website lives.

To rebuild, run `node site/src/build.ts` with Node 22.18 or newer, then copy the files from `site/dist/` to the repository root.

GitHub Pages serves the repository root at forkcommons.org (see `CNAME`).

## Project status

Fork Commons is forming as a nonprofit. The site lists each product's status as Live, Released, Beta, Preview, In development, Planned or Archived, taken from that product's own repository.
