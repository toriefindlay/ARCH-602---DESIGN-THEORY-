# Project log

Out of Our Hands · ARCH 602 · 6 November 2026

The prompts below are kept as they were written. The first list produced the cube piece on `main`. The second list, brought up to date on 17 November 2026, produced the flock instrument on `TORIE`.

## Brief

> okay lets build something. I have a task to create an app. this is the input we have so far: Out of Our Hands: If the designer writes the rules, who authors the form?
>
> Proposal:
>
> This project explores how generative design relocates authorship from determining a final form to establishing the conditions through which it emerges. Drawing on Philip Ball’s discussions of self-organisation and Sanford Kwinter’s account of form as the product of interacting processes, we will investigate the relationship between design intention, user participation, and emergent outcomes. Our working argument is that authorship resides in the choices embedded in a system’s rules, constraints, and possibilities. Through an interactive app, we will invite users to consider how their decisions shape a result; they will influence the design but may not fully anticipate its outcome, raising the question of whether those who create the system or those who engage with it retain authorship of the final product. Is it both?
>
> App:
>
> Out of Our Hands will allow users to experiment with three variables: attraction, repulsion, and mimicry. The users will observe their effects on an evolving visual configuration. We will develop the app’s specific form through research and experimentation, using changing outcomes to prompt reflection on control, intention, and authorship. The app will identify the sources behind its rules and distinguish our modelling assumptions.
>
> References:
>
> Philip Ball, "Pattern Formation in Nature: Physical Constraints and Self-Organising Characteristics", AD magazine, Volume 82, Issue 2, March 2012, Wiley & Sons
>
> Philip Ball, “The self-made tapestry”, Oxford University Press, Bubbles pp17-49
>
> Kwinter, Sanford. “African Genesis (A Presentation).” Assemblage, no. 36 (1998): 24–41.

## Prompts

1. make it so the user would sign their name using the cursor and the modifers are mapped to their signature.
2. make the boids interact more with the strokes
3. okay now lets imagine this in 3 dimensions. make the square a cube - the signature exists on all 6 planes of the cube, and the interactions happen with all boids within the cube. make the cube rotateable
4. change the color palette to this: *(Creative Code palette)*
5. make the boids the pink color and make the background outside the cube white. Make the boids move slightly slower and more organically.
6. make the boids leave trails that then define the pattern
7. the boids should be evenly spaced and moving freely without constraint before the signature is added.
8. the trails should form after the boids find the signature. They arent interacting in the centre of the cube. They nee to move slower and the trails need to disappear after a while
9. We need more boids. Also, they need to speed up 25%
10. more boids - six sides means six times to original number
11. the trails should remain permanent and then, 20 seconds after the signature, all movement stops and the oustide of the cube disappears and only the trails the boids left remains. as a scultpure that can be 3d printed.
12. the boids need to move 20% faster
13. make the title "out of our hands" bigger and give it a white glow behind the pink lettering
14. makew the font the same as the text below and make the "if the desinger writes the rule, who authors the form?" slightly smaller
15. "out of our hands" same font, no glow, white outline
16. no white ouline, make a showdow instead
17. lets change the font fo the title to Neutra Sans
18. No serif fonts
19. no drop shadow on "out of our hands" its not working, make the title stand out, i like the pink
20. make the boids a shape that makes sense for architectture
21. mke them tiny arrows
22. make it so I can zoom into the cube
23. the boids slow down MASSIVELY after the signature, they need to sustain speed
24. make the movement stop 15 seconds after the boids meet in the centre
25. the shapes made at the end dont look differnt enough, what variables can we cahnge to make the rsultant shape unique?
26. okay go
27. okay- dont attact to the centre
28. make the like boids on each face be drawn to each other at the end of their journey on the faces
29. 5 seconds after the like boids meet, make all movement end and the teal box disappearsw to reaveal the pink shape created
30. make the attraction, repulsion and mimicry sliders a graphic on a 3d cube instead of a slider - these are not modifiers to the user and should. not look like they are
31. make the "sign" and "turn" more intunitve - right now you need to toggle between them, lets make signing is the first option and the view is a plan view - if you switch to 3d cube view, you exit sign view
32. lets reduce the boids by 1/3
33. okay - at the end, it shows the paths made by the bouds, an d then it needs to create a shape, by shrinkwrappping the shape made by the boids. that shall be the funal shape
34. the boids only follow the first stroke - they shoud floow all strokes - lets make a cickale box that says "done" when entering the signature that then converts the scene from plan view to 3d view
35. k. what about the shrinkwrap?

## Where the prompts landed

Signing is the plan. Done commits every stroke and opens the cube. The marks stay free until then, then divide across all of the strokes. Attraction, repulsion, and mimicry are read from the signature and drawn as a cube, not offered as sliders. Five seconds after the marks meet, movement stops and the teal cube leaves. The paths remain, then a skin is shrink-wrapped around them. That skin is the final form.

## Prompts for the current instrument

A new start replaced the cube. Wording below is the prompt as given. A few early passes survive only as a shortened record; those are marked.

1. nevermind. Lets start something new.
2. The project prompt for Out of Our Hands: a signature drives a 3D boid sculpture, three interpretations, a fourth experiment, Reynolds, and an architecture theory instrument.
3. Keep working on the existing app: see the boids move and draw continuous lines so the sculpture builds over time; slow smooth organic motion; pause, restart, speed.
4. Set up the five basic rules first (cohesion 35%, separation 65% with close-range priority, alignment 55% matching direction and speed, momentum with low max speed, limited acceleration, and max turn rate, local awareness with an adjustable moderate neighbourhood). Actual Reynolds calculations. Start boids on the signature with velocities along the strokes. “Please implement these five rules first, make sure they work together, and let me test the results before adding anything else.”
5. undo the last command
6. Preserve the three studies and their current starting mixes. Keep boids and trails on screen. Improve containment and camera framing. Refine cohesion, separation, alignment, local awareness, momentum, signature attraction, stroke following, boundaries, and trails. *(shortened record)*
7. Add selectable modifiers under Texture, Volume, and Motion. Wind first: a gentle directional current, shared deterministic field, one selection, None included, strength 0 equals the base simulation.
8. Add Zebra Stripes as the next modifier. Keep the wind gust from being cancelled, and restart all four drawings when a modifier or its strength changes.
9. Continue Out of Our Hands by adding Reaction under Texture.
10. Continue Out of Our Hands by adding Bubbles under Volume.
11. Continue Out of Our Hands by adding Porosity under Volume.
12. Update the existing Out of Our Hands app to support three simultaneous modifiers and spectrum-based colour control.
13. Improve the visibility of modifier effects and introduce a workflow for applying modifiers around a selected point in the sculpture. Then: pause working. Then the same prompt was uploaded again, including Murmuration.
14. Update Out of Our Hands so the swoops and curves of the handwritten signature automatically determine where influence nodes are placed.
15. Apply the attached colour palette to the existing Out of Our Hands app. Chalk, Charcoal, Lagoon, Deep Forest, Sand, Sunflower, Sky, Coral, Terracotta, Stone.
16. Continue Out of Our Hands. Make the signature’s direction changes directly organize the sculpture, with modifiers acting at those locations.
17. Make the signature meaningfully determine the spatial organization of the result. Preserve cohesion, separation, and alignment as three different interpretations of that organization.
18. commit this to the DEMO 2 branch on the github Arch 606
19. Replace the tangled boid tubes with a continuous growing body. Let the signature determine its overall structure, and let the boids shape its surface. Keep the three studies distinct. Start with only Bubbles and Porosity. Show the prototype before adding anything else.
20. The current prototype looks like an inflated outline of the signature. Change the formation approach. Use the signature’s turning points as starting locations for growth. Let material grow outward from them, connect between nearby regions, and develop depth, chambers, and openings. The signature should influence the arrangement without becoming the outline of the finished object. Let cohesion gather and merge growing regions, separation keep spaces open between them, and alignment stretch connections into flowing surfaces. Bubbles should create rounded chambers. Porosity should create connected openings through the body. These effects need to change the overall structure, not just make its skin lumpy or remove surface patches. Make the boids’ activity drive the developing form rather than merely deforming a shape that already exists. Keep the existing simple interface and show me this change before adding anything else.
21. Build on the current result—do not restart or create a separate prototype. Refine these forms toward the cellular reference: Cohesion merges nearby lobes into smooth chambers. Separation connects isolated beads with thin membranes. Alignment stretches the connections into flowing surfaces. Clean up jagged gaps without closing intentional openings.
22. Keep the current shape improvements, but restore all previously implemented modifiers under Texture, Volume, and Motion.
23. Stop
24. Open the file i pushed to the Demo 2 branch and lets work on that one again
25. okay run it
26. good. Lets make the nodes at the directi9on changes of the intersections the place where a bubble or a void would form under the volume controls.
27. the bubbles should grow much bigger and the porosity should leave holes. either can be bigger or smaller depending on the slider setting
28. Bubbles not that big. Make then 75% smaller overall. The Porosity should be holes, not rings.
29. lets make porosity informed by the signature at intervals between the nodes. The Pores can be smaller than the bubbles, but create gaps in the shape, while keeping the shape whole.
30. that didn't work - make porosity affect the shape at the end by eroding the spaces bewteen the tubes on a sliding scale.
31. cool. k. Now lets make the reaction add mass in snaking tendrils out from the nodes. Keep the sahpe within the frame and the trnedrils should taper off
32. make a slider for each of the 3 modifier catergories
33. Add Smoke under Motion. From each signature-derived node, grow a thin tendril that gradually extends outward, curls, branches softly, and widens into a smoke-like plume.
34. Move Reflection from Motion to Texture. Make Reflection smoothly blend adjoining tubes and surfaces so they look as though they are melting into each other. Give the merged surface a glossy, glass-like finish.
35. Move Gesture to Volume. Grow fluid, expressive brushstroke forms from the signature-derived nodes.
36. Add or refine Murmuration under Motion so the boids behave like a flock of birds swirling around the signature-derived nodes.
37. Refine Stripes under Texture to resemble zebra stripes: bold, irregular, flowing bands that fork, merge, and taper across the surface.
38. Make the selected colour concentrate around the signature-derived nodes and gradually fade to transparent farther away. Remove the controls in the pasted image and leave the spectrum slider.
39. stop
40. we are going to remove all of the modifiers execpt bubble, reflection and smoke. Make sure these three modifiers are working exactly as i asked for in the previous prompts.
41. bubbles need to be bigger
42. the bubbles need to grow out of the nodes adnd be bigger,
43. the bubbles are still invisible, them 75% larger
44. one big bubble on each node. Thats what i want.
45. make the bubbles 100% bigger, they are invisible.
46. when I select a modifier, even after the signature is done, the app shoild restart the agents and add the modifer.
47. Okay. It looks like the bubbles were not visible bevause the modifier button was not working properly. They need to be at the node and 200% smaller than they are now.
48. lets make the bubbles 50% smaller.
49. okay, now lets make sure we have nodes on the signature at every place that the direction changes - right now it seems to be missing a few
50. add porosity back in the smae way we had it before
51. remove the color tabs above the color spectrum bar and replace it with slider that increases or decreases the lighness/saturation of the color
52. make the color of the "Cohesion" object the same as the other objects, currently it is a completetly differnt color.
53. smoke is not working like I want - remove it and replace it with the "Reaction" modifier we deleted. The tendrils should be the same colour as the rest of the object
54. Where is my app? This "live reaction check" is the only thing is can see.
55. make the bubbles increase or decrease in size smoothly on the slider bar. They should almost disappear at the lowest end.
56. the "Separation" study should have the agents and tubes avoid a zone around the nodes, in addition to what they currently do.
57. Add an "Inversion" modifier that reverses the boids’ movement when selected, so they travel in the opposite direction.
58. in "the Experiement" window, the three studies should merge together in the same final forms shown in the three windows above. Their individual toggles below the "experiment" window will determine how big or small they are. remove the nieghbourhood toggle as it doesn't seem to do antyhing.
59. make inversion a modifier under "motion"
60. okay push this to my arch 602 design thoery repo and save it to the branch "torie"
61. remove the inversion modifier and replace it with a murmuration modifier kiek the one we had before
62. Move the existing Symmetry toggle to work in “The Experiment” window only. Make it mirror the complete generated object across a central plane, including all geometry and keep it joined at the mirror line. Keep the original object and show its mirrored counterpart together, updating as the form grows. Preserve the current symmetry effect’s appearance, fit both halves on screen, and leave the three studies unchanged.
63. Add a graphic directly to the app’s research section titled “From Designing Forms to Designing Systems.” Use the five stages and descriptions from the attached image, connected by arrows, with a simple geometric illustration for each. Match the app’s existing colours and typography. Arrange horizontally on desktop and vertically on mobile, with readable text.
64. move the section "From Designing Forms to Designing Systems" directly under "the Experiment section.”
65. Add a timeline titled “From Mathematical Thinking to Artificial Intelligence” using the attached images timeline content. Show the nine historical periods, with their related milestones expandable underneath. Keep descriptions brief and follow the editorial notes about approximate dates. Match our existing colour palette and typography.
66. commit this to the branch TORIE
67. Change the existing nine-era timeline into a horizontal line with nine clickable nodes. Start all eras collapsed, showing only their date and title. Clicking an era expands its description and milestones in a panel beneath the timeline; clicking it again closes it. Open only one era at a time and highlight its node. Preserve the existing content, colours, and typography. Allow horizontal scrolling where needed.
68. add these milestones under the appropriate era - avoid duplications
69. add a mini graphic for each of the eras on the timeline in the colors of the pallete. Remove the text that says "Dates are approximate. A range marks when a way of working became important, not the year it began or ended" ubder the title.
70. lets move the section "From Designing Forms to Designing Systems" to the space under the title "out of our hands"
71. change the title section to look like this: a kicker, huge OUT OF OUR HANDS, “From our hands, beyond our control.”, and the question beside the title.
72. add a title above the signature section that says "The Gesture"
73. Make sure all the section headings are the same size, font and have the same capitalization.
74. Replace the text under "where the rules come from" with the nine author notes: Reynolds, Ball, Ball, Kwinter, Menges, Negroponte, van Ameijde, Weinstock, Weinstock and Stathopoulos.
75. create a citations section with this information in it formatted correctyl to chicago style citations.
76. Add a section titled “Modifiers Explored” directly below “The Experiment” and above the timeline. Display the twelve-modifier image without cropping. This is an illustrative reference gallery, not new modifier controls.
77. Replacde the text under the sliders in "the Experiment" section with this: Bring the three studies together to create your own composition. Use the sliders to adjust the size of each form, and turn on Symmetry to join it with its mirror image. Your changes here leave the studies above unchanged. Pause to explore the form, Restart to watch it grow again, or Fit View to bring the whole object back into view.
78. change the text next to the signature window this: Every form begins with your signature. Its curves and turns guide a flock of digital agents, whose movement follows three behaviours: cohesion, separation, and alignment. Three studies begin with the same signature, each giving a different behaviour more influence. In The Experiment, you can bring their forms together and shape your own composition. Make your mark to see what unfolds.
79. Make the interface bolder using our existing colour palette. Give each section a distinct background colour, alternating stronger colours with lighter sections. Use Chalk, Stone, or Charcoal for text depending on which is easiest to read against the background. Keep sections with sliders, buttons, and interactive models on lighter backgrounds so the controls remain clear. Extend section colours across the full width with generous padding, and preserve the existing layout and functionality.
80. change the background color of "the Gesture" to Lagoon, #579B89, and make the signature window area white.
81. okay - save this to the main branch of Arch 602 design theory on Github
82. save this to the branch TORIE
83. Use the eight images in the Desktop “Out of Our Hands - Canva Images” folder to compose an editorial image layer throughout the app.
84. undo this last task
85. revert to the last save
86. Add Canva-19.png to the Citations section as a full-height panel on the right, about 30% of the section.
87. Add Canva-23.png and Porous-bone-cropped.png to “Where the Rules Come From,” birds above bone, in the left column.
88. Add Canva-24.png to “The Gesture,” beneath “Make your mark to see what unfolds,” aligned with the text and the bottom of the signature window.
89. Place Membrane-forms-transparent.png beneath the question in the title, crossing the green–yellow boundary.
90. Add Pask-diagram-chalk.png to the modifiers section, flush with the top and the right edge, behind the controls.
91. Add Faceted-reflections.png as a full-width strip between “From Designing Forms to Designing Systems” and “The Gesture.”
92. okay lets save this.
93. Add the proposal text under the systems diagram in “From Designing Forms to Designing Systems,” then adjust it to drop “architectural” and the dash in “lies and how much control.”
94. Replace the studies introduction, the modifier instructions, the empty-state line, the three slider names, and the colour line, and keep the layout and functionality unchanged.
95. Make clickable controls easier to recognise throughout the app. Rectangular buttons and modifier options, category colour and a check when selected, hover, pressed, and keyboard-focus states, readable disabled labels, and larger slider handles.
96. Save a backup of the current app, then publish this version so it can be shared. Include all images. Check that the live app loads.
97. Add a “Download STL” button to The Experiment window. Export the current combined object, including visible geometry, study sizes, modifiers, and symmetry. Add a “Print size (mm)” field defaulting to 100 mm. Download as `out-of-our-hands.stl`. Flag open surfaces or disconnected parts. Don’t reshape or join the object yet.
98. okay refresh this link and save it

## Where the current prompts landed

The page on `TORIE` is the flock instrument, not the cube. A signature places the agents. Three studies let cohesion, separation, or alignment lead, and The Experiment shows those three forms together, with size sliders and a symmetry mirror. Texture, volume, and motion each take one modifier. Nodes sit at changes of direction. The research page carries the five-stage diagram, the proposal, the nine-era timeline, the source notes, the citations, and the section photographs. Download STL saves the current experiment at the chosen print size and reports that the tubes are still open and the pieces are still separate. The shared page is https://toriefindlay.github.io/ARCH-602---DESIGN-THEORY-/
