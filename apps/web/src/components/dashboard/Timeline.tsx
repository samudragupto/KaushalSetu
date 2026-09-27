import { motion } from 'framer-motion';
import clsx from 'clsx';
import { BadgeCheck, Briefcase, CircleX, GraduationCap, Lightbulb, LogOut, Search, Store, TrendingUp, Wrench } from 'lucide-react';
import type { TimelineItem } from '../../lib/types';
import { dateShort } from '../../lib/format';
import { itemVariants, listVariants } from '../../lib/motion';

const ICONS: Record<string, JSX.Element> = {
  TRAINING_START: <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.5} />,
  TRAINING_END: <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.5} />,
  PLACED: <Briefcase className="h-3.5 w-3.5" strokeWidth={1.5} />,
  JOB_SWITCH: <Briefcase className="h-3.5 w-3.5" strokeWidth={1.5} />,
  SELF_EMPLOYED: <Store className="h-3.5 w-3.5" strokeWidth={1.5} />,
  APPRENTICE: <Wrench className="h-3.5 w-3.5" strokeWidth={1.5} />,
  WAGE_CHANGE: <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />,
  VERIFIED: <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.5} />,
  REJECTED: <CircleX className="h-3.5 w-3.5" strokeWidth={1.5} />,
  ATTRITION: <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />,
  UNEMPLOYED: <Search className="h-3.5 w-3.5" strokeWidth={1.5} />,
  DROPPED_OUT: <CircleX className="h-3.5 w-3.5" strokeWidth={1.5} />,
  SKILL_GAP: <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.5} />,
};

const TONE: Record<string, string> = {
  VERIFIED: 'bg-success-50 text-success border-[#CDEBD7]',
  REJECTED: 'bg-danger-50 text-danger border-[#F7CFCF]',
  ATTRITION: 'bg-warning-50 text-warning border-[#F6DDB5]',
  UNEMPLOYED: 'bg-warning-50 text-warning border-[#F6DDB5]',
  DROPPED_OUT: 'bg-danger-50 text-danger border-[#F7CFCF]',
  SKILL_GAP: 'bg-saffron-50 text-[#B45309] border-[#FBE3B5]',
  WAGE_CHANGE: 'bg-primary-50 text-primary border-primary-100',
};

const SOURCE: Record<string, string> = {
  BOT: 'WhatsApp',
  TRAINER_REPORT: 'Trainer report',
  EMPLOYER_VERIFIED: 'Employer',
  EPFO_SIM: 'EPFO signal',
  AGENT_CALL: 'Agent call',
  EMPLOYER_LINK: 'Employer link',
  ENROLMENT: 'Enrolment',
  AGENT: 'Agent call',
};

export function Timeline({ items, glosses = {}, titleFor }: { items: TimelineItem[]; glosses?: Record<string, string>; titleFor?: (item: TimelineItem) => string }) {
  return (
    <motion.ol className="relative space-y-4 border-l border-line pl-5" variants={listVariants} initial="initial" animate="animate">
      {items.map((it, i) => {
        const quote = it.detail.match(/"([^"]+)"/)?.[1];
        return (
          <motion.li key={`${it.at}-${i}`} variants={itemVariants} className="relative">
            <span className={clsx('absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full border bg-white', TONE[it.kind] ?? 'border-line text-primary')}>{ICONS[it.kind] ?? <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.5} />}</span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[13px] font-medium text-ink">{titleFor ? titleFor(it) : it.title}</p>
              <p className="num text-[11px] text-muted">
                {dateShort(it.at)}
                {SOURCE[it.source] ? ` · ${SOURCE[it.source]}` : ''}
              </p>
            </div>
            {it.detail && <p className="mt-0.5 text-[12px] leading-5 text-muted">{it.detail}</p>}
            {quote && glosses[quote] && <p className="mt-0.5 text-[12px] italic leading-5 text-[#4B5563]">English: {glosses[quote]}</p>}
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
