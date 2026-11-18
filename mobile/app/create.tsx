import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { PhotoCard, Rows, ListRow, Screen, TopBar, UIconButton, H1, Dim, type IconName, type PhotoSource } from '@/components/ui';
import { PHOTOS, type PhotoName } from '@/assets/photos';
import { GAME_ART, type GameArtName } from '@/assets/games';

interface Tile {
  title: string;
  subtitle: string;
  href: Href;
}

interface Row {
  title: string;
  icon: IconName;
  href: Href;
}

const TILES: (Tile & { photo: PhotoName; art?: GameArtName })[] = [
  { title: 'Import a link', subtitle: 'Video or website', href: '/import' as Href, photo: 'tacos' },
  { title: 'New post', subtitle: 'Recipe, photo, video', href: '/post/new' as Href, photo: 'plating' },
  { title: 'Start a game', subtitle: 'Mystery Kitchen', href: '/play/mystery/lobby' as Href, photo: 'pizza', art: 'mystery_kitchen' },
  { title: 'Scan a cookbook', subtitle: 'Pages to recipes', href: '/cookbook-library' as Href, photo: 'cookbook' },
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
            source={(t.art ? GAME_ART[t.art] : PHOTOS[t.photo]) as PhotoSource}
            fade="both"
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
