# Out of Our Hands

An interactive field for ARCH 602, Make It Configurable. The designer writes three rules. A person signs. The signature is measured as three strengths, and the figure is what those rules do with a beginning nobody drew.

## Run

Open `index.html` in a browser. No install, account, or build step. The page does not need a network connection.

## What a signature changes

The field is a cube. Choose Sign and draw on the front face; the same stroke is placed on all six faces. Choose Turn and drag to orbit. Every mark inside the cube takes part, and any mark near the ink on a face is pulled toward it, pushed off it, and steered along it. Clear the signature to start again.

- **Attraction** is how tightly the ink sits around its own center. A gathered name pulls marks together.
- **Repulsion** is how far the hand travels. A long name pushes marks apart.
- **Mimicry** is how steadily each part of the stroke continues the last. A smooth heading makes marks copy their neighbours’ direction.

Until you sign, the field uses an opening set of strengths. Hold pauses the field. Replay this beginning repeats the same start with the current strengths. Another beginning changes only the start. The same seed and the same strengths produce the same sequence.

## What the model assumes

The rules, population, radii, constant speed, frame, colours, opening strengths, and the translation from signature to strengths are fixed in `model.js` and `app.js`. The page lists them. Attraction and repulsion reduce Philip Ball’s account of pattern as local physical constraint. Mimicry reduces Sanford Kwinter’s account of form as the trace of interacting processes, and here it means copying a neighbour’s direction, not copying an image. This is not a model of soap film, a crowd, or a building.

## Files

- `index.html` — page, question, controls, sources
- `style.css` — the plate
- `model.js` — the rules
- `app.js` — drawing and the controls
