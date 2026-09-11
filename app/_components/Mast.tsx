import Link from 'next/link';
import { Context } from '@/lib/coach';

export default function Mast({ ctx, title }: { ctx: Context; title: string }) {
  return (
    <div className="mast">
      <div>
        <div className="lab">Gate to Gate</div>
        <h1>{title}</h1>
      </div>
      <div className="right">
        <div>
          <div className="lab">Week</div>
          <div className="v">{ctx.week}</div>
        </div>
        <div>
          <div className="lab">Block</div>
          <div className="v">{ctx.block.n}</div>
        </div>
        <div>
          <div className="lab">Champs</div>
          <div className="v">{ctx.daysToChamps}d</div>
        </div>
        <div style={{ alignSelf: 'center' }}>
          <Link href="/settings" className="lab" style={{ textDecoration: 'none' }}>
            Set
          </Link>
        </div>
      </div>
    </div>
  );
}
