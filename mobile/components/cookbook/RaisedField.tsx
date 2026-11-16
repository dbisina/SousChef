import React from 'react';
import { Text as RNText, TextInput, View, type TextInputProps } from 'react-native';
import { FIXED } from '@/stores/themeStore';
import { useTokens } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';

interface RaisedFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
}

/** .fld with a white (raise) fill, for fields that sit on a grey card where the plain Field would vanish. */
export function RaisedField({ label, ...rest }: RaisedFieldProps) {
  const t = useTokens();
  return (
    <View style={{ gap: 7, minWidth: 0 }}>
      <RNText className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 12, paddingStart: 4 }}>
        {label}
      </RNText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={FIXED.placeholder}
        selectionColor={t.accent}
        {...rest}
        className="bg-raise text-ink"
        style={{
          height: 54,
          borderRadius: 18,
          paddingHorizontal: 18,
          fontFamily: FONT.sans,
          fontSize: 15,
          textAlignVertical: 'center',
        }}
      />
    </View>
  );
}
