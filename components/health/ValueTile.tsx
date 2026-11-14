import React from 'react';
import { Text as RNText, View } from 'react-native';
import { FONT, ToneBlock, useTone } from '@/components/ui';

interface Props {
  label: string;
  value: string;
  caption?: string;
  tone?: 'default' | 'soft' | 'black';
}

/** .tile with a small label above the value (MealResponse, DoctorReport). */
export function ValueTile({ label, value, caption, tone = 'default' }: Props) {
  const current = useTone();
  const fill = tone === 'soft' ? 'bg-tag-o' : tone === 'black' ? 'bg-night' : 'bg-surface';
  return (
    <ToneBlock
      tone={tone === 'black' ? 'dark' : tone === 'soft' ? 'light' : current}
      className={`flex-1 ${fill}`}
      style={{ borderRadius: 24, padding: 14, gap: 2, minWidth: 0 }}
    >
      <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
        {label}
      </RNText>
      <RNText
        className="text-ink"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontFamily: FONT.display, fontSize: 22, lineHeight: 25, letterSpacing: -0.44 }}
      >
        {value}
      </RNText>
      {caption ? (
        <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
          {caption}
        </RNText>
      ) : (
        <View />
      )}
    </ToneBlock>
  );
}
