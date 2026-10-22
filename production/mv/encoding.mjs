// Encoder registry and argument planning for the film renderer. This module
// never encodes and never prints; render-film.mjs owns logging and exit codes.

import {spawn} from 'node:child_process';

const COLOR_ARGS=['-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709'];
const OPTION_ORDER=['preset','crf','quality','bitrate'];
const OPTION_FLAGS={preset:'-preset',crf:'-crf',quality:'-quality',bitrate:'-b:v'};
const BITRATE_PATTERN=/^\d+(?:\.\d+)?[kKmM]?$/;

export const SUPPORTED_ENCODERS=['libx264','libx265','av1_amf'];

// bitDepths maps a supported depth to the encoder's output pixel format.
// rawvideo input is always 8-bit rgba, even on the 10-bit route.
const REGISTRY={
  libx264:{family:'h264',backend:'cpu',defaults:{preset:'fast',crf:'19'},
    bitDepths:{8:'yuv420p'},options:['preset','crf'],paddingUnit:null},
  libx265:{family:'hevc',backend:'cpu',defaults:{preset:'fast',crf:'19'},
    bitDepths:{8:'yuv420p',10:'yuv420p10le'},options:['preset','crf'],paddingUnit:null},
  av1_amf:{family:'av1',backend:'gpu',defaults:{quality:'balanced',bitrate:'24M'},
    bitDepths:{8:'yuv420p'},options:['quality','bitrate'],paddingUnit:16},
};

const TEN_BIT_NOTES=[
  '输入仍是 8-bit RGBA rawvideo，输出为 10-bit yuv420p10le；只改变编码位深，不改变送入 FFmpeg 的像素字节。',
  '把 8-bit Canvas/位图转换为 10-bit 编码不会恢复原素材中不存在的色阶细节，也不等于端到端 10-bit 制作流程。',
  '10-bit HEVC 的输出兼容性低于 8-bit H.264，编码成本更高；不要假定所有播放器都能播放，色彩参数仍按 BT.709 SDR 设置。',
];

export class EncodingError extends Error{
  constructor(message,{code,details}={}){
    super(message);
    this.name='EncodingError';
    this.code=code;
    this.details=details??null;
  }
}

function show(value){
  if(typeof value==='string')return JSON.stringify(value);
  if(value===undefined)return 'undefined';
  if(typeof value==='number'&&Number.isNaN(value))return 'NaN';
  if(typeof value==='symbol')return value.toString();
  try{return JSON.stringify(value)??String(value)}catch{return String(value)}
}

function parseBitDepth(raw){
  const n=typeof raw==='number'?raw
    :typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;
  return n===8||n===10?n:null;
}

function parseCrf(raw){
  if(typeof raw==='number')return Number.isInteger(raw)&&raw>=0&&raw<=51?raw:null;
  if(typeof raw!=='string')return null;
  const text=raw.trim();
  if(!/^[+-]?\d+$/.test(text))return null;
  const n=Number(text);
  return n>=0&&n<=51?n:null;
}

function parsePreset(raw){
  return typeof raw==='string'&&raw.trim()!==''?raw.trim():null;
}

function parseBitrate(raw){
  if(typeof raw!=='string'&&typeof raw!=='number')return null;
  const text=String(raw).trim();
  return BITRATE_PATTERN.test(text)?text:null;
}

function alternativesFor(encoder,bitDepth){
  const hints=[];
  for(const name of SUPPORTED_ENCODERS){
    if(name!==encoder&&REGISTRY[name].bitDepths[bitDepth])hints.push(`--encoder ${name} --bit-depth ${bitDepth}`);
  }
  for(const depth of Object.keys(REGISTRY[encoder].bitDepths).map(Number)){
    if(depth!==bitDepth)hints.push(`--encoder ${encoder} --bit-depth ${depth}`);
  }
  return hints;
}

export function resolveEncoding({encoder='libx264',bitDepth=8,overrides={}}={}){
  const name=typeof encoder==='string'?encoder.trim():String(encoder??'');
  const spec=REGISTRY[name];
  if(!spec){
    throw new EncodingError(
      `Unsupported encoder ${show(encoder)}; supported encoders: ${SUPPORTED_ENCODERS.join(', ')}.`,
      {code:'INVALID_ENCODER',details:{encoder:encoder??null,supported:[...SUPPORTED_ENCODERS]}});
  }

  const depth=parseBitDepth(bitDepth);
  if(depth===null){
    throw new EncodingError(
      `Unsupported bit depth ${show(bitDepth)}; allowed values: 8, 10.`,
      {code:'INVALID_BIT_DEPTH',details:{bitDepth:bitDepth??null,allowed:[8,10]}});
  }

  const outputPixelFormat=spec.bitDepths[depth];
  if(!outputPixelFormat){
    const supported=Object.keys(spec.bitDepths).map(Number);
    const alternatives=alternativesFor(name,depth);
    throw new EncodingError(
      `${name} cannot encode ${depth}-bit output (supported: ${supported.map(d=>`${d}-bit`).join(', ')}). `+
      `Use ${alternatives.join(' or ')}.`,
      {code:'UNSUPPORTED_COMBINATION',details:{encoder:name,bitDepth:depth,supportedBitDepths:supported,alternatives}});
  }

  if(overrides===null||typeof overrides!=='object'||Array.isArray(overrides)){
    throw new EncodingError('overrides must be an object with preset/crf/quality/bitrate keys.',
      {code:'INVALID_OPTION',details:{option:'overrides',value:show(overrides)}});
  }

  // Only explicit values count; undefined means "not supplied" so callers can
  // build the overrides object unconditionally.
  const explicit={};
  for(const [key,value] of Object.entries(overrides)){
    if(value===undefined)continue;
    if(!OPTION_ORDER.includes(key)){
      throw new EncodingError(
        `Unknown override option ${show(key)}; allowed options: ${OPTION_ORDER.join(', ')}.`,
        {code:'INVALID_OPTION',details:{option:key,allowed:[...OPTION_ORDER]}});
    }
    explicit[key]=value;
  }

  const ignoredOptions=OPTION_ORDER.filter(key=>key in explicit&&!spec.options.includes(key));
  const warnings=[];
  if(ignoredOptions.length){
    warnings.push(
      `${name} does not use ${ignoredOptions.map(key=>OPTION_FLAGS[key]).join('/')}; `+
      `ignoring explicitly requested ${ignoredOptions.join(', ')}.`);
  }

  const quality={};
  if(name==='av1_amf'){
    quality.quality='quality' in explicit?String(explicit.quality):spec.defaults.quality;
    if('bitrate' in explicit){
      const bitrate=parseBitrate(explicit.bitrate);
      if(bitrate===null){
        throw new EncodingError(
          `bitrate must match ${BITRATE_PATTERN} (for example 24M); received ${show(explicit.bitrate)}.`,
          {code:'INVALID_OPTION',details:{option:'bitrate',value:explicit.bitrate}});
      }
      quality.bitrate=bitrate;
    }else quality.bitrate=spec.defaults.bitrate;
  }else{
    if('preset' in explicit){
      const preset=parsePreset(explicit.preset);
      if(preset===null){
        throw new EncodingError(
          `preset must be a non-empty string; received ${show(explicit.preset)}.`,
          {code:'INVALID_OPTION',details:{option:'preset',value:explicit.preset}});
      }
      quality.preset=preset;
    }else quality.preset=spec.defaults.preset;
    if('crf' in explicit){
      const crf=parseCrf(explicit.crf);
      if(crf===null){
        throw new EncodingError(
          `crf must be an integer between 0 and 51; received ${show(explicit.crf)}.`,
          {code:'INVALID_OPTION',details:{option:'crf',value:explicit.crf}});
      }
      quality.crf=String(crf);
    }else quality.crf=spec.defaults.crf;
  }

  const codecArgs=['-c:v',name];
  if(name==='av1_amf')codecArgs.push('-quality',quality.quality,'-b:v',quality.bitrate);
  else codecArgs.push('-preset',quality.preset,'-crf',quality.crf);

  return{
    encoder:name,
    family:spec.family,
    backend:spec.backend,
    bitDepth:depth,
    inputPixelFormat:'rgba',
    outputPixelFormat,
    codecArgs,
    pixelFormatArgs:['-pix_fmt',outputPixelFormat],
    colorArgs:[...COLOR_ARGS],
    quality,
    ignoredOptions,
    notes:depth===10?[...TEN_BIT_NOTES]:[],
    warnings,
    paddingUnit:spec.paddingUnit,
  };
}

function escapeRegExp(text){
  return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}

function hasEncoderLine(output,encoder){
  return new RegExp(`^\\s*V\\S*\\s+${escapeRegExp(encoder)}\\s`,'m').test(output);
}

function tail(text,limit=3000){
  return text?text.slice(-limit):null;
}

// Small shared runner for the capability probes. It never rejects: a missing or
// crashed binary becomes an error field so callers can decide the exit code.
function runProcess(command,args,{timeoutMs=15000}={}){
  const timeout=Number.isFinite(Number(timeoutMs))&&Number(timeoutMs)>0?Number(timeoutMs):15000;
  return new Promise(resolve=>{
    let settled=false,stdout='',stderr='',child;
    const finish=result=>{
      if(settled)return;
      settled=true;
      if(timer)clearTimeout(timer);
      resolve(result);
    };
    let timer;
    try{
      child=spawn(command,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
    }catch(error){
      resolve({code:null,stdout:'',stderr:'',error});
      return;
    }
    timer=setTimeout(()=>{
      try{child.kill()}catch{}
      finish({code:null,stdout,stderr,error:new Error(`timed out after ${timeout}ms`)});
    },timeout);
    child.stdout.on('data',chunk=>{if(stdout.length<4_000_000)stdout+=chunk});
    child.stderr.on('data',chunk=>{if(stderr.length<4_000_000)stderr+=chunk});
    child.on('error',error=>finish({code:null,stdout,stderr,error}));
    child.on('close',code=>finish({code:typeof code==='number'?code:null,stdout,stderr,error:null}));
  });
}

// `ffmpeg -h encoder=<name>` prints "Supported pixel formats:" plus the formats
// the build can accept from this encoder. The request is only advisory to
// FFmpeg, so reading the list is how a caller refuses an unsupported target
// before a long encode.
export function parseSupportedPixelFormats(text){
  const lines=String(text??'').split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    const match=/^\s*Supported pixel formats:\s*(.*)$/.exec(lines[i]);
    if(!match)continue;
    const formats=match[1].trim().split(/[\s,]+/).filter(Boolean);
    for(let j=i+1;j<lines.length;j++){
      const next=lines[j];
      if(/^\s*$/.test(next)||/AVOptions:/.test(next))break;
      const trimmed=next.trim();
      // Continuation lines list formats only; anything else starts a new section.
      if(!/^[a-z0-9_ ,]+$/i.test(trimmed))break;
      formats.push(...trimmed.split(/[\s,]+/).filter(Boolean));
    }
    // Some builds decorate entries (for example "yuv420p10le (10-bit)"); keep the
    // plain format tokens only so the membership check stays exact.
    return formats.filter(format=>/^[a-z0-9_]+$/i.test(format));
  }
  return [];
}

export async function probeEncoderPixels(ffmpegPath,encoder,{timeoutMs=15000}={}){
  const command=ffmpegPath===undefined||ffmpegPath===null
    ?(process.env.FFMPEG_PATH||'ffmpeg'):String(ffmpegPath);
  const name=String(encoder??'').trim();
  if(name===''){
    return{supported:[],pixelFormatListRead:false,detail:'probeEncoderPixels() needs an encoder name.',stderrTail:null};
  }
  const result=await runProcess(command,['-hide_banner','-h',`encoder=${name}`],{timeoutMs});
  if(result.error){
    return{supported:[],pixelFormatListRead:false,
      detail:`Cannot run ${show(command)} -h encoder=${name}: ${result.error.message}`,
      stderrTail:tail(result.stderr)};
  }
  const supported=parseSupportedPixelFormats(`${result.stdout}\n${result.stderr}`);
  return{
    supported,
    pixelFormatListRead:supported.length>0,
    detail:supported.length
      ?`${name} lists ${supported.length} supported pixel formats (${show(command)} -h encoder=${name}, exit ${result.code}).`
      :`${show(command)} -h encoder=${name} printed no parseable "Supported pixel formats:" line (exit ${result.code}); the encoder may still be usable, but its format list could not be checked.`,
    stderrTail:tail(result.stderr),
  };
}

// Verify what the encoder actually wrote. FFmpeg may auto-select a different
// pixel format than -pix_fmt requested, so the requested value alone is not
// evidence that the file is 8-bit or 10-bit.
export async function probeOutputPixelFormat(file,{ffprobePath='ffprobe',timeoutMs=20000}={}){
  const command=ffprobePath===undefined||ffprobePath===null||String(ffprobePath).trim()===''
    ?'ffprobe':String(ffprobePath);
  const target=String(file??'');
  const args=['-v','error','-select_streams','v:0','-show_entries',
    'stream=codec_name,profile,pix_fmt,width,height,bits_per_raw_sample','-of','json',target];
  const result=await runProcess(command,args,{timeoutMs});
  if(result.error){
    return{verified:false,pixelFormat:null,codecName:null,profile:null,width:null,height:null,bitsPerRawSample:null,
      detail:`Cannot run ${show(command)}: ${result.error.message}`,stderrTail:tail(result.stderr)};
  }
  if(result.code!==0){
    return{verified:false,pixelFormat:null,codecName:null,profile:null,width:null,height:null,bitsPerRawSample:null,
      detail:`${show(command)} exited ${result.code} while probing ${show(target)}.`,stderrTail:tail(result.stderr)};
  }
  let stream=null;
  try{stream=JSON.parse(result.stdout)?.streams?.[0]??null}
  catch(error){
    return{verified:false,pixelFormat:null,codecName:null,profile:null,width:null,height:null,bitsPerRawSample:null,
      detail:`Cannot parse ffprobe JSON: ${error.message}`,stderrTail:tail(result.stderr)};
  }
  if(!stream){
    return{verified:false,pixelFormat:null,codecName:null,profile:null,width:null,height:null,bitsPerRawSample:null,
      detail:`ffprobe reported no video stream for ${show(target)}.`,stderrTail:tail(result.stderr)};
  }
  return{
    verified:typeof stream.pix_fmt==='string'&&stream.pix_fmt!=='',
    pixelFormat:stream.pix_fmt??null,
    codecName:stream.codec_name??null,
    profile:stream.profile??null,
    width:stream.width??null,
    height:stream.height??null,
    bitsPerRawSample:stream.bits_per_raw_sample??null,
    detail:typeof stream.pix_fmt==='string'&&stream.pix_fmt!==''
      ?`ffprobe reports ${stream.pix_fmt} (${stream.codec_name??'unknown codec'}, profile ${stream.profile??'unknown'}).`
      :'ffprobe reported no pix_fmt for the first video stream.',
    stderrTail:tail(result.stderr),
  };
}

export async function probeEncoder(ffmpegPath,encoder,{timeoutMs=15000}={}){
  const command=ffmpegPath===undefined||ffmpegPath===null
    ?(process.env.FFMPEG_PATH||'ffmpeg'):String(ffmpegPath);
  const name=String(encoder??'');
  if(name.trim()===''){
    return{listed:false,scope:'encoders-list',exitCode:null,stderrTail:null,
      detail:'probeEncoder() needs an encoder name.'};
  }
  const timeout=Number.isFinite(Number(timeoutMs))&&Number(timeoutMs)>0?Number(timeoutMs):15000;

  return await new Promise(resolve=>{
    let settled=false,stdout='',stderr='',child,timer;
    const finish=result=>{
      if(settled)return;
      settled=true;
      if(timer)clearTimeout(timer);
      resolve(result);
    };
    try{
      child=spawn(command,['-hide_banner','-encoders'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
    }catch(error){
      resolve({listed:false,scope:'encoders-list',exitCode:null,stderrTail:null,
        detail:`Cannot start FFmpeg at ${show(command)}: ${error.message}`});
      return;
    }
    timer=setTimeout(()=>{
      try{child.kill()}catch{}
      finish({listed:false,scope:'encoders-list',exitCode:null,stderrTail:tail(stderr),
        detail:`Timed out after ${timeout}ms running ${show(command)} -hide_banner -encoders.`});
    },timeout);
    child.stdout.on('data',chunk=>{if(stdout.length<4_000_000)stdout+=chunk});
    child.stderr.on('data',chunk=>{if(stderr.length<4_000_000)stderr+=chunk});
    child.on('error',error=>{
      finish({listed:false,scope:'encoders-list',exitCode:null,stderrTail:tail(stderr),
        detail:`Cannot start FFmpeg at ${show(command)}: ${error.message}. Check --ffmpeg or FFMPEG_PATH.`});
    });
    child.on('close',code=>{
      // The encoders list goes to stdout on current builds; stderr is kept too
      // so older builds and startup diagnostics are still matched/reported.
      const listed=hasEncoderLine(`${stdout}\n${stderr}`,name);
      const exitCode=typeof code==='number'?code:null;
      finish({
        listed,
        scope:'encoders-list',
        exitCode,
        stderrTail:tail(stderr),
        detail:listed
          ?`${name} is listed by ${show(command)} -hide_banner -encoders (exit ${exitCode}); `+
            '列表存在不等于硬件初始化成功 (a listed encoder does not prove the hardware backend initializes).'
          :`${name} is not listed by ${show(command)} -hide_banner -encoders (exit ${exitCode}); `+
            'the build may lack it, or FFmpeg failed before printing its encoder list.',
      });
    });
  });
}
