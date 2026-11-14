import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { PhotoCard, Rows, ListRow, Screen, TopBar, UIconButton, H1, Dim } from '@/components/ui';
import type { IconName } from '@/components/ui';
import { SAMPLE } from '@/assets/sample';

interface Tile {
  title: string;
  subtitle: string;
  photo: keyof typeof SAMPLE;
  href: Href;
}

interface Row {
  title: string;
  icon: IconName;
  href: Href;
}

const TILES: Tile[] = [
  { title: 'Import a link', subtitle: 'Video or website', photo: 'phone', href: '/import' as Href },
  { title: 'New post', subtitle: 'Recipe, photo, video', photo: 'gnocchi', href: '/post/new' as Href },
  { title: 'Start a game', subtitle: 'Mystery Kitchen', photo: 'friends', href: '/play/mystery/lobby' as Href },
  { title: 'Scan a cookbook', subtitle: 'Pages to recipes', photo: 'cookbook', href: '/cookbook-library' as Href },
];

const ROWS: Row[] = [
  { title: 'Scan my plate', icon: 'scan', href: '/(tabs)/scan' as Href },
  { title: 'Log a reading', icon: 'drop', href: '/health/log' as Href },
  { title: 'Write a recipe', icon: 'edit', href: '/(tabs)/upload' as Href },
];

export default function CreateScreen() {
  const router = useRouter();
  const go = (href: Href) => router.replace(href);

  return (
    <Screen tone="dark" scroll bottomSpace={32}>
      <TopBar
        title={
          <H1>
            <Dim>What are{'\n'}</Dim>we making?
          </H1>
        }
        right={<UIconButton icon="close" label="Close" onPress={() => router.back()} />}
      />
      <View style={{ gap: 12, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {TILES.map((t) => (
          <PhotoCard
            key={t.title}
            source={SAMPLE[t.photo]}
            height={170}
            radius={26}
            width="48%"
            style={{ flexGrow: 1 }}
            title={t.title}
            titleSize={17}
            subtitle={t.subtitle}
            captionInset={16}
            onPress={() => go(t.href)}
          />
        ))}
      </View>
      <Rows box>
        {ROWS.map((r) => (
          <ListRow key={r.title} title={r.title} icon={r.icon} onPress={() => go(r.href)} />
        ))}
      </Rows>
      </View>
    </Screen>
  );
}
