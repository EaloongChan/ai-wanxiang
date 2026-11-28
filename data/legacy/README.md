# Legacy dataset (AI Wanxiang)

This folder preserves the open dataset of the previous site, AI Wanxiang. It is no longer part of the site's navigation or sitemap. The build copies it to `/api/legacy/` so that people who were already using the JSON endpoints keep working links.

| File | Contents |
|---|---|
| `tools.json` | 246 AI tools with bilingual fields |
| `prompts.json` | 86 prompts with variable definitions (bilingual) |
| `glossary.json` | 92 AI terms |
| `playbooks.json` | 43 task-oriented playbooks |
| `models.json` | 78 model families |
| `learn.json`, `news.json`, `categories.json`, `tags-en.json`, `i18n.json`, `feeds.json` | Supporting data |

Code in this repository is MIT licensed. The content in this folder is licensed CC BY 4.0.

`prompts.json` is still read by the build: the Prompt Template Builder tool renders its English prompts.
