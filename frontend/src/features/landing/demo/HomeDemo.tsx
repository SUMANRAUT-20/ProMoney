import { useState } from 'react';
import { Plus, RotateCcw, ShoppingBasket } from 'lucide-react';
import { Badge, Bar, Button, Card, Collapse, Draft, Roll, Row, Stage, Text, Window, type Act } from './kit';
import './hero-demo.css';

const entry = '¥1,200 · Food & Dining';
const initial = { draft: false, typed: '', saved: false, spend: 4800, onTrack: false };
const poster = { ...initial, saved: true, spend: 4750, onTrack: true };
const rest = { wide: { x: 528, y: 218 }, compact: { x: 228, y: 242 } };
type Scene = typeof initial;

async function play(a: Act<Scene>) {
  await a.wait(700);
  await a.click({ at: 'add', x: 0.24 });
  await a.set({ draft: true });
  await a.wait(520);
  await a.click('entry');
  await a.type('typed', entry, { interval: 65 });
  a.mark('Quick entry');
  await a.wait(420);
  await a.click({ at: 'save', x: 0.16 });
  await a.set({ draft: false, saved: true });
  await a.wait(470);
  await a.set({ spend: poster.spend });
  await a.wait(970);
  a.mark('Transaction and safe-to-spend updated');
  await a.move({ at: 'goal', x: 0.16, y: 0.82 });
  await a.set({ onTrack: true });
  await a.wait(850);
  a.mark('Goal on track');
  await a.wait(2100);
  await a.click({ at: 'reset', x: 0.24 });
  await a.set(initial);
  await a.move(rest[a.layout]);
  await a.wait(900);
}

function SafeToSpend({ value }: { value: number }) {
  return (
    <Card className="pm-demo-safe" gap={5} pad="small">
      <Text>Safe to spend / day</Text>
      <div className="pm-demo-balance" aria-label={'¥' + value.toLocaleString('en-US')}><Roll align="start">{'¥' + value.toLocaleString('en-US')}</Roll></div>
    </Card>
  );
}

function Goal({ onTrack }: { onTrack: boolean }) {
  return (
    <Card className="pm-demo-goal" gap={8} pad="small" data-target="goal">
      <svg className="pm-demo-ring" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle cx="24" cy="24" r="19" />
        <circle cx="24" cy="24" r="19" pathLength="100" strokeDasharray="100" data-progress={onTrack ? 'on-track' : 'in-progress'} />
      </svg>
      <div>
        <Text>Savings goal</Text>
        <div className="pm-demo-goal-status">
          <Badge tone="success" data-goal-status={onTrack}>On track</Badge>
        </div>
      </div>
    </Card>
  );
}

function Activity({ scene }: { scene: Scene }) {
  return (
    <div className="pm-demo-activity">
      <Collapse open={scene.draft}>
        <div className="pm-demo-quick">
          <Draft value={scene.typed} full={entry} editing={scene.draft} data-target="entry" data-cursor="ibeam" />
          <Button variant="primary" data-target="save">Save</Button>
        </div>
      </Collapse>
      <Collapse open={scene.saved}>
        <Row
          className="pm-demo-transaction"
          pad={8}
          title="Food & Dining"
          lead={<ShoppingBasket size={16} />}
          meta={<Text>−¥1,200</Text>}
        />
      </Collapse>
      {[84, 108, 66, 94, 80, 70].map((w, i) => (
        <Row key={w} pad={10} className="pm-demo-filler" lead={<Bar w={24} h={24} r={7} tone={2} />} title={<Bar w={w} />} meta={<Bar w={i % 2 ? 36 : 48} />} />
      ))}
    </div>
  );
}

export default function HomeDemo() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="pm-demo">
      <div role="img" aria-label="Animated sample of ProMoney Home. Adding a ¥1,200 Food & Dining transaction updates the daily Safe to spend amount. The demo then highlights an on-track savings goal.">
        <Stage
          width={720}
          height={340}
          compact={{ below: 600, width: 358, height: 314 }}
          initial={initial}
          poster={poster}
          script={paused ? undefined : play}
          cursor={paused ? undefined : { at: rest, ripple: true }}
          className="landing-product-demo"
        >
          {(scene) => (
            <Window className="pm-demo-window" url="ProMoney" lights="grey" body={{ className: 'pm-demo-body' }}>
              <div className="pm-demo-sidebar" data-crop>
                <Bar w={24} h={24} r={7} tone={5} />
                {[0, 1, 2, 3, 4].map((index) => <Bar key={index} w={18} h={18} r={5} tone={index === 0 ? 4 : 2} />)}
              </div>
              <div className="pm-demo-main">
                <div className="pm-demo-top">
                  <div className="pm-demo-title"><Text>Home</Text><Badge>Sample data</Badge></div>
                  <Button variant="ghost" className="pm-demo-reset" data-target="reset" icon={<RotateCcw size={14} />}>Reset</Button>
                  <Button variant="primary" data-target="add" icon={<Plus size={14} />}>Add</Button>
                </div>
                <div className="pm-demo-metrics">
                  <SafeToSpend value={scene.spend} />
                  <Goal onTrack={scene.onTrack} />
                </div>
                <Activity scene={scene} />
              </div>
            </Window>
          )}
        </Stage>
      </div>
      <button className="pm-demo-toggle" type="button" onClick={() => setPaused(!paused)}>{paused ? 'Replay demo' : 'Pause demo'}</button>
    </div>
  );
}
