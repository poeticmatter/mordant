# Mordant — playtest brief (round 1)

## Running it
**Remote (phone or any browser):** https://poeticmatter.github.io/mordant/

Locally, from `C:\Code\SoloDeck`:

```bash
npm run dev -- --host
```

- **PC:** open http://localhost:3000.
- **Phone:** use the "Network" address Vite prints (same Wi-Fi), portrait.

The rules screen opens on your first visit; it's also under **Menu → Rules**.

## What to do
- Play **3 games**. If you have the energy, a 4th on a seed you've already played (Menu → New game → type the
  seed) so you can see whether replaying a known setup changes how you play.
- Play however feels natural. There's no need to think aloud or take notes.
- After each game, or at the end, open **Menu → Copy log to clipboard** and paste it back to me. It holds every
  game in this browser: seed, every hang, and timestamps.
- Then just tell me you're done. I'll ask questions from there.

## Things worth trying at least once
- Tap a cloth that's already hanging on the rack.
- Open **Menu → Your cloths** between seasons.
- Use the hang preview: tap a peg once to see what would happen, then tap again (or press "Hang it") to commit.

## What I'm uncertain about (so you know what the logs are for)
- Whether the game's main skill — deciding *which neighbour soaks a cloth first, and in which season* — is
  something a person sees and plans for, or something only a search algorithm finds. My simple
  "human-like" bots never figured it out; a planning bot did, by a wide margin.
- Whether stripes, "soaked" marks and kinship read clearly at a glance, on a phone in particular.
- Whether 4 seasons is the right length.
- Whether the target score is anywhere near reasonable. It's set from bot results, not from people.

## Known rough edges
- I haven't opened the UI in a browser myself: it's covered by render tests, but layout on your screen size is
  unverified. Screenshots of anything broken are very welcome.
- No undo: hanging draws a new cloth, which would leak information if undone. The preview is the safety net.
