/**
 * The playtest link's questions and the file's note (ui/recorder.js), shared by
 * the classic panel and the Studio's "Before you go" until part 2 of the
 * switch-over removes the classic one.
 *
 * They are moved here rather than copied because testers are answering both
 * looks in the same week: two spellings of one question would be two questions
 * in the files that come back.
 */

import { line } from './line.js';

export const PLAYTEST = Object.freeze({
  title: line('label', 'Before you go'),
  sub: line('label', 'for the playtest only'),
  lessons: line('instruction', 'What three things did this game teach you? In your own words.'),
  confusing: line('instruction', 'What confused or annoyed you?'),
  fileNote: line('reading', 'The file holds how long you spent on each screen, what you clicked, how many keys you '
    + 'pressed (not what they were), your answers, your saved game and your browser and screen size. Nothing has '
    + 'been sent anywhere: download it and send it back.'),
  download: line('label', 'Download the playtest file'),
  // Asked partway through, the questions must not read as the end of the game.
  keepPlaying: line('instruction', 'Not yet — back to the game'),
  playAgainAfter: line('reading', 'Starting again clears the saved game the file carries, so send the file first.'),
});
