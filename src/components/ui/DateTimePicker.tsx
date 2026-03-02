'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { ChevronDownIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomDateRangeValue {
  fromDate: Date | undefined;
  fromTime: string;
  toDate: Date | undefined;
  toTime: string;
}

interface CustomDateRangePickerProps {
  value?: CustomDateRangeValue;
  onChange?: (value: CustomDateRangeValue) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomDateRangePicker({
  value,
  onChange,
}: CustomDateRangePickerProps) {
  const [fromOpen, setFromOpen] = React.useState(false);
  const [toOpen, setToOpen] = React.useState(false);

  const [range, setRange] = React.useState<CustomDateRangeValue>(
    value ?? {
      fromDate: undefined,
      fromTime: '00:00:00',
      toDate: undefined,
      toTime: '23:59:00',
    },
  );

  const update = (patch: Partial<CustomDateRangeValue>) => {
    const next = { ...range, ...patch };
    setRange(next);
    onChange?.(next);
  };

  const setNow = () => {
    const now = new Date();
    update({
      toDate: now,
      toTime: format(now, 'HH:mm:ss'),
    });
  };

  return (
    <div
      style={{
        padding: 12,
        background: '#0d0d0f',
        border: '1px solid #27272a',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: "'DM Mono','Fira Code',monospace",
      }}
    >
      {/* ── From ── */}
      <div>
        <div style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'inherit' }}>
          From
        </div>
        <FieldGroup className="flex-row">
          <Field>
            <FieldLabel htmlFor="from-date" style={{ fontSize: 10, color: '#71717a' }}>Date</FieldLabel>
            <Popover open={fromOpen} onOpenChange={setFromOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  id="from-date"
                  className="w-36 justify-between font-normal"
                  style={{
                    background: '#09090b',
                    border: '1px solid #3f3f46',
                    borderRadius: 6,
                    color: range.fromDate ? '#fafafa' : '#52525b',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    height: 34,
                  }}
                >
                  {range.fromDate ? format(range.fromDate, 'MMM d, yyyy') : 'Select date'}
                  <ChevronDownIcon data-icon="inline-end" size={13} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start"
                style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10 }}
              >
                <Calendar
                  mode="single"
                  selected={range.fromDate}
                  captionLayout="dropdown"
                  defaultMonth={range.fromDate}
                  onSelect={date => {
                    update({ fromDate: date });
                    setFromOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </Field>

          <Field className="w-32">
            <FieldLabel htmlFor="from-time" style={{ fontSize: 10, color: '#71717a' }}>Time</FieldLabel>
            <Input
              type="time"
              id="from-time"
              step="1"
              value={range.fromTime}
              onChange={e => update({ fromTime: e.target.value })}
              style={{
                background: '#09090b',
                border: '1px solid #3f3f46',
                borderRadius: 6,
                color: '#fafafa',
                fontSize: 12,
                fontFamily: 'inherit',
                height: 34,
              }}
              className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </Field>
        </FieldGroup>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#27272a' }} />

      {/* ── To ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
            To
          </div>
          <button
            onClick={setNow}
            style={{
              background: 'transparent',
              border: '1px solid #3f3f46',
              borderRadius: 5,
              color: '#71717a',
              fontSize: 10,
              fontFamily: 'inherit',
              cursor: 'pointer',
              padding: '2px 8px',
              letterSpacing: '0.05em',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#6366f1';
              e.currentTarget.style.color = '#6366f1';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#3f3f46';
              e.currentTarget.style.color = '#71717a';
            }}
          >
            Now
          </button>
        </div>

        <FieldGroup className="flex-row">
          <Field>
            <FieldLabel htmlFor="to-date" style={{ fontSize: 10, color: '#71717a' }}>Date</FieldLabel>
            <Popover open={toOpen} onOpenChange={setToOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  id="to-date"
                  className="w-36 justify-between font-normal"
                  style={{
                    background: '#09090b',
                    border: '1px solid #3f3f46',
                    borderRadius: 6,
                    color: range.toDate ? '#fafafa' : '#52525b',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    height: 34,
                  }}
                >
                  {range.toDate ? format(range.toDate, 'MMM d, yyyy') : 'Select date'}
                  <ChevronDownIcon data-icon="inline-end" size={13} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start"
                style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10 }}
              >
                <Calendar
                  mode="single"
                  selected={range.toDate}
                  captionLayout="dropdown"
                  defaultMonth={range.toDate}
                  onSelect={date => {
                    update({ toDate: date });
                    setToOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </Field>

          <Field className="w-32">
            <FieldLabel htmlFor="to-time" style={{ fontSize: 10, color: '#71717a' }}>Time</FieldLabel>
            <Input
              type="time"
              id="to-time"
              step="1"
              value={range.toTime}
              onChange={e => update({ toTime: e.target.value })}
              style={{
                background: '#09090b',
                border: '1px solid #3f3f46',
                borderRadius: 6,
                color: '#fafafa',
                fontSize: 12,
                fontFamily: 'inherit',
                height: 34,
              }}
              className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </Field>
        </FieldGroup>
      </div>
    </div>
  );
}