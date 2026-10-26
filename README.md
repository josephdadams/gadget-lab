# Gadget Lab

A 3D city game for the browser where you're the Lab's gadget tester. Swing between skyscrapers on a grappling hook in each arm, catch crooks running off with stolen stuff, and get paid for every gadget test.

**Play it:** https://josephdadams.github.io/gadget-lab/

It runs on tablets, phones, and computers. There is nothing to install.

## How to play

Crooks have a red **!** over them, and arrows at the edge of the screen and the minimap show where they are. Run into one to catch it, or catch it with a gadget for bigger pay. Spend your money in **🧪 The Lab** on new gadgets. Every gadget has tests that pay extra when you finish them.

Play from behind your tester (3rd person) or out of their goggles (1st person), where you see your arms reach out with each hook. Switch with the **👁** chip, `V`, the right stick click, or **View** in the menu.

Your money, gadgets and finished tests are saved on the device.

### Your dragon

A giant red dragon flies around the buildings. Press the **🐉** button (`R` on a keyboard, D-pad up on a controller) and it swoops down to pick you up. While you ride it, steer where you look, fly faster with forward, flap up with jump, and **breathe fire** with the gadget button to toast crooks. Swoop low over a crook to snatch them. Press 🐉 again to hop off, or shoot a hook to jump off and swing away.

### Monster mode

Press **🦖** (`G` on a keyboard, D-pad down on a controller, or **Monster mode** on the menu) to turn into **ZILLA**, a giant lizard taller than almost every building. Walk through buildings to knock them down, punch them with the hook buttons, melt them with **atomic breath** (the gadget button), stomp with jump, and spin your tail with reel.

Pick a fight with **🦍 MEGA APE** (`1`, D-pad left), who leaps across the city and punches, or **🐲 THREE-HEADED KING** (`2`, D-pad right), who flies, swoops and shoots lightning. Win for a big cash prize. Press 🦖 again to change back, and the Lab's robots rebuild the city.

### Gadgets

- 🪝 **Grapple Hooks** (free, always on your arms): shoot a hook, swing, let go, fly. Hook a crook to yank them in.
- 💥 **Fling Blaster** ($150): a big blast of air that flings crooks across the street. Aim at your feet to blast yourself into the sky.
- 🥅 **Net Launcher** ($300): wraps up a crook in one shot.
- 🌀 **Portal Gun** ($600): shoot a blue portal, then an orange one. Anything that goes in one comes out the other.
- ❄️ **Freeze Ray** ($900): freezes a crook in ice. Touch them to make the catch.
- 🚀 **Rocket Boots** ($1300): hold the gadget button to fly. Fuel refills while you rest.

### Keyboard and mouse

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Run |
| Mouse | Look around (click the game first) |
| Left / right click, `Q` / `E` | Shoot the left / right hook. Hold to hang on, let go to release |
| `Space` | Jump (again in the air for a flip jump) |
| `Shift` | Reel your hooks in |
| `F` | Use your gadget (hold for Rocket Boots) |
| `V` | Switch between 1st and 3rd person |
| `R` | Call your dragon. Press again to hop off |
| Riding the dragon | Mouse or `A` / `D` steers, `W` goes faster, `Space` flaps up, `F` breathes fire |
| `G` | Monster mode on and off |
| As the monster | Clicks or `Q` / `E` punch, `F` atomic breath, `Space` stomp jump, `Shift` tail spin, `1` fights the ape, `2` fights the three-headed dragon |
| `1`–`6`, mouse wheel | Switch gadget |
| `Tab` | The Lab |
| `Esc` | Menu |

### Controller

| Button | Action |
| --- | --- |
| Left stick | Run |
| Right stick | Look around |
| `LT` / `RT` | Left / right hook (hold to hang on) |
| `A` | Jump |
| `RB` or `X` | Use your gadget |
| `LB` or `B` | Reel your hooks in |
| `Y`, D-pad | Switch gadget |
| Right stick click | Switch between 1st and 3rd person |
| D-pad up, left stick click | Call your dragon. Press again to hop off |
| Riding the dragon | Sticks steer, `A` flaps up, `RB` or `X` breathes fire |
| D-pad down | Monster mode on and off |
| As the monster | `LT` / `RT` punch, `RB` or `X` atomic breath, `A` stomp jump, `LB` or `B` tail spin, D-pad left fights the ape, D-pad right fights the three-headed dragon |
| `Start` | The Lab |
| `Back` | Menu |

On menus, the D-pad or left stick moves between buttons, `A` picks, and `B` goes back.

### Touch

- Drag anywhere on the left side to run. Drag on the right side to look around.
- **Tap the city** to shoot a hook right where you tapped: the left half of the screen is your left arm, the right half is your right. Tap that hook's button to let go.
- Or hold a hook button to hang on and let go to release.
- The other buttons jump, use your gadget, and reel in.
- The **👁** chip at the top switches between 1st and 3rd person.
- The **🐉** button calls your dragon (tap again to hop off). While riding, the gadget button breathes fire.
- The **🦖** button turns you into a giant monster. The hook buttons punch, 🔵 breathes, ⤴ stomps, 🌀 spins your tail, and 🦍 or 🐲 picks a fight.

### Camera wands

Open **Camera wands** in the menu and pick **Wands**. Hold a brightly colored wand in each hand (a painted ping-pong ball or a circle of craft foam on a stick works great). The game starts out looking for **neon green on the left** and **hot pink on the right**.

- **Flick a wand up** to shoot that arm's hook where the wand points. A colored circle on the screen shows where that is.
- **Flick a wand down** to let go of that hook. With no hooks out, it jumps.
- **Hold both wands high** to run forward, and move both to one side to turn.
- **Pull a wand close** to the camera to use your gadget.
- Using other colors? Tap **Set colors**, hold each wand in its circle on the camera picture, and wait for the countdown.

The camera picture stays on the device. Pick two colors that look very different from each other and from the room, and play in good light.

## Running it yourself

It's plain HTML and JavaScript with [three.js](https://threejs.org/) from a CDN, so there is no build step. Serve the folder with any web server, for example:

```bash
python3 -m http.server 8791
```

Then open http://localhost:8791. Every push to `main` deploys to GitHub Pages.

## License

[MIT](LICENSE)
