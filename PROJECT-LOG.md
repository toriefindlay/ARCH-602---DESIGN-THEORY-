# Project log

Out of Our Hands · ARCH 602 · 6 November 2026

The prompts below are kept as they were written. They are the sequence that produced the piece on `main`.

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
