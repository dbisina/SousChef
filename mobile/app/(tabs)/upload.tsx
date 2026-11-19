import { Redirect } from 'expo-router';

/** The old one-page recipe form is gone: writing a recipe is now the four short steps in `app/recipe/new.tsx`. */
export default function UploadScreen() {
  return <Redirect href="/recipe/new" />;
}
