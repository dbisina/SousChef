// When a video's caption holds no recipe the server asks for a few pictures of the video (the ingredient list and the steps,
// usually on screen). This asks the person for screenshots from their photos and hands back their addresses.
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export const MAX_FRAMES = 6;

export function askForFrames(): Promise<string[] | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Add screenshots of the video',
      "The caption does not have the recipe. Choose up to 6 screenshots of the video that show the ingredients and the steps, and we will read them.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        {
          text: 'Choose screenshots',
          onPress: async () => {
            try {
              const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: MAX_FRAMES,
                quality: 0.7,
              });
              resolve(picked.canceled ? null : picked.assets.slice(0, MAX_FRAMES).map((a) => a.uri));
            } catch {
              resolve(null);
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
