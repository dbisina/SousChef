import React from 'react';
import { View } from 'react-native';
import { SAMPLE } from '@/assets/sample';
import { AUTHORS } from '@/data/sample/social';
import { Icon, UAvatar } from '@/components/ui';
import type { Author, Conversation } from '@/types/social';

export const authorById = (id: string): Author | undefined => AUTHORS.find((a) => a.id === id);

interface Props {
  conversation: Conversation;
  size?: number;
  /** Green presence dot on friends who are online. */
  showPresence?: boolean;
}

/** Avatar for a conversation: friend photo, two-photo stack for groups, store icon for orders, cover for communities. */
export function ConversationAvatar({ conversation: c, size = 52, showPresence = true }: Props) {
  if (c.kind === 'order') {
    return (
      <View
        accessibilityLabel={c.title}
        className="items-center justify-center bg-night"
        style={{ width: size, height: size, borderRadius: size / 2 }}
      >
        <Icon name="store" color="paper" size={size >= 48 ? 'md' : 'sm'} />
      </View>
    );
  }
  if (c.kind === 'group') {
    const people = c.participantIds.map(authorById).filter((a): a is Author => !!a).slice(0, 2);
    const small = Math.round(size * 0.7);
    return (
      <View accessibilityLabel={c.title} style={{ width: size, height: size }}>
        {people[0] ? (
          <View style={{ position: 'absolute', left: 0, top: 0 }}>
            <UAvatar name={people[0].displayName} source={SAMPLE[people[0].avatar]} size={small} />
          </View>
        ) : null}
        {people[1] ? (
          <View style={{ position: 'absolute', right: 0, bottom: 0 }}>
            <UAvatar name={people[1].displayName} source={SAMPLE[people[1].avatar]} size={small} />
          </View>
        ) : null}
        {!people.length ? <UAvatar name={c.title} size={size} /> : null}
      </View>
    );
  }
  if (c.kind === 'community') {
    return <UAvatar name={c.title} source={c.photo ? SAMPLE[c.photo] : null} size={size} />;
  }
  const author = authorById(c.participantIds[0] ?? '');
  const source = author ? SAMPLE[author.avatar] : c.photo ? SAMPLE[c.photo] : null;
  return (
    <View style={{ width: size, height: size }}>
      <UAvatar name={c.title} source={source} size={size} />
      {showPresence && (c.online ?? author?.online) ? (
        <View
          className="bg-rating-lo-dot border-2 border-ground"
          style={{ position: 'absolute', right: 1, bottom: 1, width: 13, height: 13, borderRadius: 7 }}
        />
      ) : null}
    </View>
  );
}
