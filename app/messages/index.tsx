import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { photoSource } from '@/lib/photo';
import { ConversationRow } from '@/components/chat/ConversationRow';
import { Chip, ChipRow, H2, ListRow, Muted, Rows, Screen, Sheet, TopBar, UAvatar, UIconButton, UInput } from '@/components/ui';
import { filterConversations, useMessageStore, type ConversationFilter } from '@/stores/messageStore';
import { useSocialStore } from '@/stores/socialStore';
import { apiEnabled } from '@/lib/api';
import { ME_ID, type Conversation } from '@/types/social';

const FILTERS: { id: ConversationFilter; key: string; fallback: string }[] = [
  { id: 'all', key: 'messages.filterAll', fallback: 'All' },
  { id: 'friends', key: 'messages.filterFriends', fallback: 'Friends' },
  { id: 'groups', key: 'messages.filterGroups', fallback: 'Groups' },
];

export default function MessagesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const conversations = useMessageStore((s) => s.conversations);
  const startConversation = useMessageStore((s) => s.startConversation);
  const startConversationOnServer = useMessageStore((s) => s.startConversationOnServer);
  const knownPeople = useSocialStore((s) => s.authors);
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(false);

  const rows = useMemo(() => filterConversations([...conversations], filter, query), [conversations, filter, query]);
  // With the server on, the people you can message are the ones the app knows about (you follow, or have seen).
  const people = useMemo(() => knownPeople.filter((a) => a.id !== ME_ID), [knownPeople]);

  const open = (c: Conversation) => {
    if (c.kind === 'community' && c.communityId) {
      router.push({ pathname: '/community/[id]', params: { id: c.communityId } });
      return;
    }
    router.push({ pathname: '/messages/[id]', params: { id: c.id } });
  };

  const startWith = async (authorId: string, name: string) => {
    const id = apiEnabled() ? await startConversationOnServer(authorId) : startConversation(authorId, name);
    setPicking(false);
    if (id) router.push({ pathname: '/messages/[id]', params: { id } });
  };

  return (
    <Screen>
      <TopBar
        title={t('messages.title', 'Messages')}
        right={
          <UIconButton
            tone="black"
            icon="edit"
            label={t('messages.newMessage', 'New message')}
            onPress={() => setPicking(true)}
          />
        }
      />
      <View style={{ gap: 14, flex: 1 }}>
        <UInput
          icon="search"
          label={t('messages.searchLabel', 'Search messages')}
          placeholder={t('messages.search', 'Search')}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        <View style={{ marginHorizontal: -20 }}>
          <ChipRow>
            {FILTERS.map((f) => (
              <Chip key={f.id} label={t(f.key, f.fallback)} on={filter === f.id} onPress={() => setFilter(f.id)} />
            ))}
          </ChipRow>
        </View>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {rows.length === 0 ? (
            <Muted center style={{ paddingVertical: 40 }}>
              {query.trim() ? t('messages.emptySearch', 'No conversations match your search') : t('messages.empty', 'No conversations yet')}
            </Muted>
          ) : (
            <Rows>
              {rows.map((c) => (
                <ConversationRow key={c.id} conversation={c} onPress={() => open(c)} />
              ))}
            </Rows>
          )}
        </ScrollView>
      </View>

      <Sheet visible={picking} onClose={() => setPicking(false)} title={t('messages.newMessageTitle', 'New message')}>
        <H2>{t('messages.newMessageTitle', 'New message')}</H2>
        <Rows>
          {people.map((a) => (
            <ListRow
              key={a.id}
              title={a.displayName}
              subtitle={`@${a.handle}`}
              leading={<UAvatar name={a.displayName} source={photoSource(a.avatar)} size={44} />}
              onPress={() => startWith(a.id, a.displayName)}
            />
          ))}
        </Rows>
      </Sheet>
    </Screen>
  );
}
