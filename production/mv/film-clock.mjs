// Song seconds are the output clock. The complete original Sana file begins at zero.
export const SANA_SECONDS=252.006168;
export function filmClock(source,{fps=60,offset=.064}={}){
 const sourceAtSong=song=>Math.max(source.firstPTS,Math.min(source.lastFramePTS,song-offset));
 const seconds=Math.max(SANA_SECONDS,source.endPTS+offset),frames=Math.ceil(seconds*fps);
 return{fps,offset,frames,seconds:frames/fps,sourceAtSong,sourceAtFrame:k=>sourceAtSong(k/fps),songStart:0,audioSeek:0};
}
