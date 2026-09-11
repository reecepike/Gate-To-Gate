/**
 * Fuel. The numbers scale with bodyweight, because the commonest stall at month
 * four is not a plateau — it is a 76 kg man still eating like a 70 kg one.
 */

import { dow } from './plan';

export type Targets = {
  weight: number;
  training: boolean;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  surplus: number;
};

/**
 * Maintenance is taken from the plan's own anchor: 3,300 kcal on a training day
 * at 70 kg, which is a +250 surplus, so maintenance is ~3,050 — about 43.6
 * kcal/kg on a day with a lift in it. Light days sit 400 below.
 */
export function targets(weightKg: number, iso: string): Targets {
  const wd = dow(iso);
  const training = wd !== 4 && wd !== 7;     // Thu and Sun are the light days
  const maintenance = Math.round(weightKg * 43.6);
  const kcal = Math.round((maintenance + 250 - (training ? 0 : 400)) / 10) * 10;
  const protein = Math.round(weightKg * 1.85);
  const fat = Math.round(weightKg * 1.36);
  const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  return { weight: weightKg, training, kcal, protein, carbs, fat, surplus: 250 };
}

export const STACK: { when: string; what: string; protein: number; kcal: number }[] = [
  { when: 'Breakfast', what: '3 eggs scrambled with 40 g cheese, 2 slices toast with butter', protein: 30, kcal: 640 },
  { when: 'Mid-morning', what: '300 ml whole milk', protein: 10, kcal: 190 },
  { when: 'Lunch', what: '150 g chicken, rice, whatever veg you tolerate, olive oil', protein: 46, kcal: 720 },
  { when: 'Afternoon', what: 'Cheese and crackers, or a second glass of milk', protein: 12, kcal: 320 },
  { when: 'Dinner', what: 'Two homemade burgers (300 g mince) with cheese and buns — or lasagna, or meatballs and pasta', protein: 42, kcal: 950 },
  { when: 'Evening', what: '300 ml whole milk', protein: 10, kcal: 190 },
];

export const SUPPLEMENTS: { what: string; dose: string; why: string }[] = [
  { what: 'Creatine monohydrate', dose: '5 g daily', why: 'The single highest-value supplement for lean mass and repeat-effort power. Tasteless, mixes into milk or squash, timing is irrelevant, do not bother loading.' },
  { what: 'Vitamin D3', dose: '2,000 IU, Oct–Apr', why: 'UK winter, mostly indoor training, and you are asking a lot of bone and connective tissue from a rebuilt leg.' },
];

export const CAFFEINE =
  'No caffeine at all — and it works in your favour. For a 30-second slalom run the effect is real but small, and a national championship is a terrible place to discover that 200 mg makes you jittery or unable to sleep before day two. Leave it. Ski off adrenaline. If you ever get curious, try it on a Wednesday at Aldershot — never at a race.';

export const WEDNESDAY: { time: string; what: string; detail: string }[] = [
  { time: '07:45', what: 'Breakfast', detail: 'The usual: 3 eggs, cheese, toast. ~640 kcal, 30 g protein.' },
  { time: '12:30', what: 'Main meal of the day', detail: 'Chicken and rice, or lasagna out of the freezer. ~800 kcal, 45 g protein. This is the meal that fuels the session.' },
  { time: '14:15', what: 'Leave', detail: 'Flapjack or a couple of bananas in the door pocket, 750 ml water in the car.' },
  { time: '16:30', what: 'Somewhere near Oxford', detail: 'Eat the flapjack. Arrive topped up, not empty.' },
  { time: '20:30', what: 'Car park, before you drive', detail: 'Prepped meal in a flask — meatballs and pasta travels best. Plus 500 ml. Eat before you drive, not when you get home.' },
  { time: '23:45', what: 'Home', detail: '300 ml milk if you are hungry. Otherwise straight to shower and bed.' },
];

export const RACE_DAY: { when: string; what: string; why: string }[] = [
  { when: '−3 h', what: 'Breakfast — toast, honey, banana, one egg', why: 'Carb-led, low fat, low fibre so it is gone by the start gate. Skip the cheese this once.' },
  { when: '−60 min', what: 'Banana, 300 ml water', why: 'Top-up. Nothing new, nothing you have not eaten before a Wednesday.' },
  { when: '−20 min', what: 'Inspection done, warm-up done', why: 'Warm up properly and for longer than the 18-year-olds do. A cold reconstructed knee in the start gate is a bad idea on plastic.' },
  { when: 'Between runs', what: '30–60 g carbs — banana, flapjack or squash', why: 'Second runs are lost to fuel and focus far more often than to technique.' },
  { when: '+60 min', what: 'Proper meal, 40 g protein', why: 'Especially if you are racing again tomorrow. This is the meal that decides day two.' },
  { when: 'Evening', what: 'Full dinner, contrast finishing hot, bed early', why: 'Day two is won on the evening of day one.' },
];

/* ------------------------------------------------------------ recovery */

export const SPA: { after: string; sauna: string; plunge: string; contrast: string; pool: string }[] = [
  { after: 'Hard lifting — Days 1, 2, 4, 5', sauna: 'Yes, 4 h+ later', plunge: 'Avoid 6 h', contrast: 'No', pool: 'Easy only' },
  { after: 'Day 3 — conditioning & arms', sauna: 'Yes', plunge: 'Yes', contrast: 'Yes', pool: '1 km' },
  { after: 'Wednesday gates', sauna: 'Yes', plunge: 'Yes', contrast: 'Yes', pool: '—' },
  { after: 'Golf / Z2 run', sauna: 'Yes', plunge: 'Yes', contrast: 'Yes', pool: 'Yes' },
  { after: 'Thursday recovery day', sauna: '15–20 m', plunge: 'Yes', contrast: 'Best day', pool: '800–1200 m' },
  { after: 'Race day, post-race', sauna: 'Brief', plunge: 'Yes', contrast: 'Yes', pool: 'Easy' },
  { after: 'Night before a race', sauna: '10 m max', plunge: 'No', contrast: 'No', pool: 'No' },
];

export const COLD_RULE =
  'Cold water immersion after resistance training measurably blunts the strength and muscle gains from that session. You are trying to add seven kilos of lean tissue — plunging straight after Monday’s squats feels fantastic and quietly deletes a chunk of the reason you did them. Cold is for when recovery matters more than adaptation: after gates, after races, after golf. Thursday is the exception, and that is why the week is built the way it is.';

export const SLEEP: { night: string; out: string; up: string; hours: string }[] = [
  { night: 'Sun–Tue', out: '23:15', up: '07:30', hours: '8:15' },
  { night: 'Wed', out: '00:30', up: '09:00', hours: '8:30' },
  { night: 'Thu', out: '23:00', up: '07:30', hours: '8:30' },
  { night: 'Fri–Sat', out: '23:30', up: '08:00', hours: '8:30' },
];

export const PULL_BACK_TRIGGERS = [
  'Knee swells after any session, twice in a fortnight.',
  'Resting heart rate up 7+ bpm for three straight mornings.',
  'Bodyweight drops two weeks running — you are under-eating, not over-training.',
  'You dread the Wednesday drive. That is fatigue talking, not character.',
  'Jump height on the monthly test goes down.',
];

export const PULL_BACK_ACTIONS = [
  'Drop to four days — cut Day 5, keep the other four. Then cut every top set by one and drop 10% off the bar.',
  'Drop the plyo block entirely for one week.',
  'Swap one golf round for a range session.',
  'Add an hour of sleep, not a supplement.',
  'Keep going to Aldershot. Skill work is what you protect last.',
];
