import { PHOTOS } from '@/assets/photos';
import { questionPhoto, questionPhotoName } from '@/lib/gamePhotos';

describe('a photo for every game question', () => {
  it('picks the app\'s photo that fits the words of the question', () => {
    expect(questionPhotoName('Which cheese goes into a classic carbonara?')).toBe('pasta');
    expect(questionPhotoName('What temperature sears a salmon fillet?')).toBe('salmon');
    expect(questionPhotoName('Why does sourdough need a long proof?')).toBe('toast');
    expect(questionPhotoName('Which vegetable is the main ingredient in ratatouille?')).toBe('tomatoes');
  });

  it('never gives nothing: an unmatched question gets a dish photo, the same one every time', () => {
    const a = questionPhotoName('Zzzz qqqq wwww?');
    expect(a).toBe(questionPhotoName('Zzzz qqqq wwww?'));
    expect(Object.keys(PHOTOS)).toContain(a);
    for (let i = 0; i < 200; i += 1) expect(Object.keys(PHOTOS)).toContain(questionPhotoName(`question number ${i} about nothing`));
  });

  it('uses the real photo from the server when there is one', () => {
    expect(questionPhoto({ prompt: 'Anything', imageUrl: 'https://x.test/a.jpg' })).toEqual({ uri: 'https://x.test/a.jpg' });
    expect(questionPhoto({ prompt: 'Anything about eggs' })).toBe(PHOTOS.eggs);
  });
});
