# ⛳ Footgolf

Webová hra Footgolf postavená na Next.js, Three.js (react-three-fiber) a
fyzikálnom engine Rapier. Tri jamky s kopcami, vodnými prekážkami a
bunkermi, realistická 3D grafika (dynamické tiene, odrazová voda,
procedurálne textúry) a ovládanie ťahom myšou/prstom — potiahni dozadu od
loptičky pre nabitie sily a smeru, pustením kopneš.

## Spustenie

```bash
npm install
npm run dev
```

Otvor [http://localhost:3000](http://localhost:3000).

## Ako sa hrá

- Potiahni myšou (alebo prstom) dozadu od loptičky — vzdialenosť ťahu určuje
  silu, smer ťahu určuje kam loptička poletí.
- Pusti tlačidlo/prst a loptička odletí.
- Alternatívne: šípky vľavo/vpravo na mierenie, medzerník podržať pre
  nabitie sily a pustiť pre kop.
- Vyhýbaj sa vode a snaž sa dostať loptičku do jamky na čo najmenej úderov.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- three.js cez `@react-three/fiber` a `@react-three/drei`
- Fyzika: `@react-three/rapier`
- Post-processing: `@react-three/postprocessing`
- Stav hry: `zustand`
- Tailwind CSS pre HUD/menu

Všetka grafika (textúry trávy/piesku, futbalová loptička, stromy, skaly) aj
zvuky sú generované procedurálne v kóde — žiadne externé assety.
