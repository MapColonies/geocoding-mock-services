# geocoding-mock-services

Stand-ins for the two external services [geocoding](https://github.com/MapColonies/geocoding) and
[Geocoding-Enrichment](https://github.com/MapColonies/Geocoding-Enrichment) depend on.

| Endpoint | Stands in for | Consumer |
| --- | --- | --- |
| `POST /NLP_ANALYSES` | the NLP token-type analyser (`TOKEN_TYPE_URL`) | geocoding |
| `GET /data/:userid` | the ADFS user-data service (`USER_DATA_SERVICE_ENDPOINT`) | Geocoding-Enrichment |
| `GET /liveness` | — | Kubernetes probes |

## The NLP analyser mock

The real analyser is a **RoBERTa token classifier for Hebrew, Arabic and Persian**. That matters
more than it sounds: RoBERTa segments with SentencePiece into **sub-word pieces**, not words, and
labels one piece at a time. A consumer therefore has to re-assemble pieces into words before it
can read a label.

This mock runs the **genuine `xlm-roberta-base` tokenizer** over the incoming text, so callers see
the real segmentation. Measured over 36 Israeli place names, **23 (64%) produce more pieces than
words**:

```
תל אביב    -> ['▁תל', '▁אביב']               2 words -> 2 pieces
פתח תקווה  -> ['▁פתח', '▁תק', 'ווה']         2 words -> 3 pieces
אום אל פחם -> ['▁אום', '▁אל', '▁', 'פח', 'ם'] 3 words -> 5 pieces
new york   -> ['▁new', '▁yor', 'k']          2 words -> 3 pieces
```

A mock that returned whitespace tokens taught every consumer the wrong shape, which is how
geocoding shipped a name extractor returning fragments such as `"ווה"` for `פתח תקווה`.

**The model weights are not mocked** — only the tokenizer is real. Labels come from a gazetteer
(`nlp/gazetteer.json`): the longest contiguous span of words found there is labelled `name`, every
other piece `essence`. Edit that file, or point `GAZETTEER_PATH` at your own, to extend coverage.

### Contract

```
POST /NLP_ANALYSES   { "tokens": ["בית", "ספר", "פתח", "תקווה"] }

200  [{ "tokens":     ["▁בית", "▁ספר", "▁פתח", "▁תק", "ווה"],
        "prediction": ["essence", "essence", "name", "name", "name"] }]
```

`tokens` and `prediction` are always the same length. `tokens` are the analyser's own pieces, not
the ones you sent.

> [!IMPORTANT]
> A consumer that does `tokens.filter((_, i) => prediction[i] === 'name').join(' ')` will return a
> fragment. Pieces must be merged on the `▁` (U+2581) word-start marker first, taking each word's
> label from its first piece. `NLP_TOKENIZATION_MODE=word` returns whitespace tokens instead, as a
> temporary escape hatch for a consumer that has not learned this yet — deploy it only if you must,
> because it hides the bug it exists to expose.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `SERVER_PORT` | `5002` | HTTP port |
| `RUNNING_ENV` | `development` | reported at startup |
| `NLP_TOKENIZATION_MODE` | `subword` | `subword` (real pieces) or `word` (whitespace tokens) |
| `TOKENIZER_MODEL_DIR` | `./vendor/tokenizer/xlm-roberta-base` | directory with `tokenizer.json` + `tokenizer_config.json` |
| `GAZETTEER_PATH` | `./nlp/gazetteer.json` | place names labelled `name` |

### Swapping the vocabulary

`vendor/tokenizer/xlm-roberta-base/` holds `xlm-roberta-base`'s vocabulary, vendored so the image
builds and runs without network access. `SHA256SUMS` pins what was fetched from
`https://huggingface.co/xlm-roberta-base/resolve/main/`.

If production runs a different checkpoint, drop its `tokenizer.json` and `tokenizer_config.json`
into a directory and point `TOKENIZER_MODEL_DIR` at it — no code change. The pieces will differ;
the sub-word mechanism will not.

## Resource footprint

Loading the vocabulary costs about **470ms** at startup and **~290MB RSS**, so the container needs
a memory limit in the hundreds of MB, not tens. Analysis itself is ~0.03ms per request.

## Running locally

```bash
npm install
npm start
```

```bash
npm test
```

Tests assert the tokenizer's real output; the expectations were cross-checked piece-for-piece
against the Rust `tokenizers` reference implementation (21 of 21 cases identical).
