import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  AvatarStack, BarChart, BarTitle, Body, BookCover, Bubble, Check, Chip, ChipRow, CtaBar, Display, Divider, Dim,
  Dot, Dots, Field, H1, H2, Icon, LinkText, ListRow, Muted, PhotoCard, ProgressBar, RatingTag, Ring, Rows,
  Screen, SectionLabel, Segmented, Sheet, StoryRing, Stepper, Tag, Thumb, Tile, Title, ToneBlock, TopBar,
  UAvatar, UBadge, UButton, UCard, UIconButton, UInput, USwitch,
} from '@/components/ui';
import { ICONS, type IconName } from '@/components/ui/icons';
import { SAMPLE } from '@/assets/sample';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </View>
  );
}

function Samples() {
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [n, setN] = useState(2);
  const [sheet, setSheet] = useState(false);
  const iconNames = Object.keys(ICONS) as IconName[];
  return (
    <View style={{ gap: 26, paddingHorizontal: 20, paddingVertical: 24 }}>
      <Group title="Text">
        <H1>
          Good evening <Dim>Daniel</Dim>
        </H1>
        <H2>Section heading</H2>
        <Title>Card title</Title>
        <BarTitle>Bar title</BarTitle>
        <Body>Body copy in Inter, 14 over 1.45.</Body>
        <Muted>Muted copy</Muted>
        <LinkText>Link</LinkText>
        <LinkText accent>Accent link</LinkText>
        <Display>32:14</Display>
      </Group>

      <Group title="Icons">
        <View className="flex-row flex-wrap" style={{ gap: 14 }}>
          {iconNames.map((name) => (
            <Icon key={name} name={name} />
          ))}
          <Icon name="heart" filled color="accent" />
          <Icon name="home" size="lg" />
          <Icon name="home" size="sm" color="muted" />
        </View>
      </Group>

      <Group title="Icon buttons">
        <View className="flex-row" style={{ gap: 10 }}>
          <UIconButton icon="search" label="Search" />
          <UIconButton icon="plus" label="Add" tone="black" />
          <UIconButton icon="plus" label="Add" tone="accent" />
          <UIconButton icon="close" label="Close" tone="white" size={44} />
          <PhotoCard source={SAMPLE.pasta} height={80} width={140} radius={20} fade="none"
            topLeft={<UIconButton icon="heart" label="Like" tone="glass" size={44} />}
            topRight={<UIconButton icon="more" label="More" tone="glassDark" size={44} />} />
        </View>
      </Group>

      <Group title="Cards and tiles">
        <UCard>
          <Title>Default card</Title>
          <Muted small>Surface grey, radius 28</Muted>
        </UCard>
        <UCard tone="black">
          <Title>Black card</Title>
          <Muted small>Flips its subtree to the dark set</Muted>
          <ProgressBar value={0.6} />
        </UCard>
        <UCard tone="accent">
          <Title>Accent card</Title>
        </UCard>
        <UCard tone="white">
          <Title>White card</Title>
        </UCard>
        <View className="flex-row" style={{ gap: 10 }}>
          <View style={{ flex: 1 }}><Tile value="1,840" label="kcal" /></View>
          <View style={{ flex: 1 }}><Tile value="62g" label="protein" tone="black" /></View>
          <View style={{ flex: 1 }}><Tile value="3" label="expiring" tone="accent" /></View>
          <View style={{ flex: 1 }}><Tile value="Mon" label="selected" selected /></View>
        </View>
      </Group>

      <Group title="Photo cards">
        <PhotoCard
          source={SAMPLE.salmon}
          height={170}
          title="Herb salmon"
          subtitle="35 min - Easy"
          topLeft={<Tag label="Tonight" tone="glassDark" large />}
          topRight={<UIconButton icon="bookmark" label="Save" tone="glass" size={44} />}
        />
        <PhotoCard
          source={SAMPLE.ramen}
          height={190}
          fade="both"
          topLeft={<Tag label="Dinner" tone="glass" />}
          glassBar={
            <>
              <View style={{ flex: 1 }}>
                <Title>Spicy ramen</Title>
                <Muted small>20 min</Muted>
              </View>
              <UButton label="Cook" size="sm" />
            </>
          }
        />
      </Group>

      <Group title="Chips, tags, ratings">
        <ChipRow>
          <Chip label="All" on />
          <Chip label="Quick" />
          <Chip label="Vegan" outlined />
          <Chip label="Scan plate" icon="scan" />
        </ChipRow>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          <Tag label="Default" />
          <Tag label="Orange" tone="o" />
          <Tag label="Green" tone="g" />
          <Tag label="Red" tone="r" />
          <Tag label="Black" tone="k" />
          <Tag label="Large" tone="o" large icon="clock" />
        </View>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          <RatingTag level="lo" label="Low" />
          <RatingTag level="md" label="Medium" />
          <RatingTag level="hi" label="High" emphasis />
          <RatingTag level="neutral" label="Neutral" small />
        </View>
      </Group>

      <Group title="Buttons">
        <UButton label="Start cooking" trailingIcon="arrowRight" />
        <UButton label="Add to plan" variant="accent" icon="plus" />
        <UButton label="White" variant="white" />
        <UButton label="Ghost" variant="ghost" />
        <View className="flex-row" style={{ gap: 10 }}>
          <UButton label="Small" size="sm" />
          <UButton label="Small accent" size="sm" variant="accent" />
          <UButton label="Loading" size="sm" loading />
        </View>
      </Group>

      <Group title="Inputs">
        <UInput label="Search" icon="search" placeholder="Search recipes" right={<UIconButton icon="filters" label="Filters" tone="black" />} />
        <Field label="Email" placeholder="you@example.com" />
        <Field label="Notes" placeholder="Anything else" multiline />
        <Field label="Password" placeholder="Required" error="Too short" />
        <Segmented options={[{ value: 'a', label: 'Light' }, { value: 'b', label: 'Dark' }, { value: 'c', label: 'System' }]} value={seg} onChange={setSeg} />
        <View className="flex-row items-center" style={{ gap: 18 }}>
          <USwitch label="Notifications" value={on} onValueChange={setOn} />
          <USwitch label="Off" value={false} onValueChange={() => {}} />
          <Check label="Done" checked={on} onChange={setOn} />
          <Check label="Todo" checked={false} onChange={() => {}} />
          <Stepper label="Servings" value={n} onChange={setN} min={1} max={12} />
        </View>
      </Group>

      <Group title="Progress">
        <ProgressBar value={0.4} />
        <ProgressBar value={0.7} variant="accent" />
        <Dots count={4} index={1} />
        <View className="flex-row items-center" style={{ gap: 20 }}>
          <Ring size={120} thickness={10} value={0.71}>
            <Display size={24}>32:14</Display>
          </Ring>
          <View style={{ flex: 1 }}>
            <BarChart height={80} data={[0.4, 0.55, { value: 0.82, tone: 'accent' }, 0.6, 0.48, { value: 0.52, tone: 'ink' }]} />
          </View>
        </View>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <UBadge count={3} />
          <UBadge count="12" />
          <Dot />
        </View>
      </Group>

      <Group title="Social">
        <View className="flex-row" style={{ gap: 12 }}>
          <StoryRing source={SAMPLE.chef} name="You" add seen />
          <StoryRing source={SAMPLE.p_woman} name="Ama" />
          <StoryRing source={SAMPLE.p_man} name="Tolu" />
          <StoryRing source={SAMPLE.family} name="Kemi" seen />
        </View>
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <UAvatar source={SAMPLE.p_knit} name="Dayo Ade" />
          <UAvatar name="Kemi Bello" />
          <AvatarStack people={[{ name: 'A', source: SAMPLE.p_woman }, { name: 'B', source: SAMPLE.p_man }, { name: 'C', source: SAMPLE.p_knit }]} />
          <Thumb source={SAMPLE.toast} name="Toast" />
        </View>
        <Bubble side="them">Is the pasta ready?</Bubble>
        <Bubble side="me" tick="Seen">Almost, 5 minutes.</Bubble>
        <View className="flex-row" style={{ gap: 16 }}>
          <BookCover source={SAMPLE.cookbook} title="Weeknight Dinners" kicker="Cookbook" />
          <BookCover source={SAMPLE.greens} title="Green" kicker="Vegetarian" width={100} height={140} />
        </View>
      </Group>

      <Group title="Rows and sheet">
        <Rows box>
          <ListRow icon="bell" title="Notifications" subtitle="Reminders and updates" onPress={() => {}} />
          <ListRow icon="moon" title="Dark mode" right={<USwitch label="Dark mode" value={on} onValueChange={setOn} />} />
          <ListRow leading={<Thumb source={SAMPLE.penne} name="Penne" />} title="Penne arrabbiata" subtitle="25 min" tall onPress={() => {}} />
        </Rows>
        <Divider />
        <UButton label="Open sheet" variant="ghost" onPress={() => setSheet(true)} />
        <Sheet visible={sheet} onClose={() => setSheet(false)} title="Example sheet">
          <H2>Example sheet</H2>
          <Body>Bottom sheet with scrim.</Body>
          <UButton label="Done" onPress={() => setSheet(false)} />
        </Sheet>
      </Group>
    </View>
  );
}

export default function PrimitivesGallery() {
  const router = useRouter();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen bare>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <TopBar variant="compact" title="Primitives" onBack={() => router.back()} />
        <ToneBlock tone="light" className="bg-ground">
          <SectionLabel style={{ paddingHorizontal: 20, paddingTop: 12 }}>Light</SectionLabel>
          <Samples />
        </ToneBlock>
        <ToneBlock tone="dark" className="bg-ground">
          <SectionLabel style={{ paddingHorizontal: 20, paddingTop: 12 }}>Dark</SectionLabel>
          <Samples />
        </ToneBlock>
      </ScrollView>
      <CtaBar fade>
        <UButton label="Back" variant="accent" onPress={() => router.back()} />
      </CtaBar>
    </Screen>
  );
}
