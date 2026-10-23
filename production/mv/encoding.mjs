// Encoder registry and argument planning for the film renderer. This module
// never encodes and never prints; render-film.mjs owns logging and exit codes.

import {spawn} from 'node:child_process';

const COLOR_ARGS=['-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709'];
const OPTION_ORDER=['preset','crf','quality','bitrate'];
const OPTION_FLAGS={preset:'-preset',crf:'-crf',quality:'-quality',bitrate:'-b:v'};
const BITRATE_PATTERN=/^\d+(?:\.\d+)?[kKmM]?$/;

// Convenience presets, not an allow-list. Other FFmpeg encoder names are
// accepted without inheriting another encoder's defaults.
export const SUPPORTED_ENCODERS=['libx264','libx265','av1_amf','libsvtav1','libaom-av1',
  'h264_amf','hevc_amf','h264_nvenc','hevc_nvenc','av1_nvenc','h264_qsv','hevc_qsv','av1_qsv'];

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

function flexibleEncoding(name,depth,overrides,options,pixelFormat){
  const software=name==='libsvtav1'||name==='libaom-av1';
  const known=SUPPORTED_ENCODERS.includes(name);
  const qsv=known&&name.endsWith('_qsv'),nvenc=known&&name.endsWith('_nvenc'),amf=known&&name.endsWith('_amf');
  if(depth===10&&name==='h264_qsv')throw new EncodingError('h264_qsv does not support 10-bit; use hevc_qsv or av1_qsv.',{code:'UNSUPPORTED_COMBINATION'});
  const family=name.startsWith('h264_')?'h264':name.startsWith('hevc_')?'hevc':software||name.startsWith('av1_')?'av1':'custom';
  const values=software?(name==='libsvtav1'?{preset:'6',crf:'28'}:{'cpu-used':'6',crf:'28','b:v':'0'})
    :nvenc?{preset:'p4',rc:'constqp',qp:'23'}:qsv?{global_quality:'23'}:amf?{quality:'balanced',rc:'cqp',qp_i:'23',qp_p:'23'}:{};
  const ignoredOptions=[];
  for(const [key,value] of Object.entries(overrides)){
    if(value===undefined)continue;
    if(!OPTION_ORDER.includes(key))throw new EncodingError(`Unknown override option ${show(key)}.`,{code:'INVALID_OPTION'});
    if(key==='crf'){
      const limit=software?63:51;
      const number=Number(value);
      if(!/^[0-9]+$/.test(String(value))||!Number.isInteger(number)||number>limit)throw new EncodingError(`crf must be an integer between 0 and ${limit}.`,{code:'INVALID_OPTION'});
    }
    if(key==='bitrate'&&parseBitrate(value)===null)throw new EncodingError('Invalid bitrate.',{code:'INVALID_OPTION'});
    if(String(value).trim()==='')throw new EncodingError(`Empty ${key}.`,{code:'INVALID_OPTION'});
    const flag={preset:name==='libaom-av1'?'cpu-used':'preset',crf:'crf',quality:'quality',bitrate:'b:v'}[key];
    values[flag]=String(value);
    if(key==='bitrate'&&(nvenc||qsv||amf)){
      values.rc=nvenc?'vbr':amf?'vbr_peak':undefined;
      delete values.qp;delete values.qp_i;delete values.qp_p;delete values.global_quality;
    }
  }
  Object.assign(values,options);
  const outputPixelFormat=pixelFormat??(depth===10?'yuv420p10le':'yuv420p');
  const inputFormat=pixelFormat??(qsv||nvenc?(depth===10?'p010le':'nv12'):outputPixelFormat);
  const decodedFormat={nv12:'yuv420p',p010le:'yuv420p10le'}[outputPixelFormat]??outputPixelFormat;
  return{encoder:name,family,backend:software?'cpu':qsv||nvenc||amf?'gpu':'custom',bitDepth:depth,
    inputPixelFormat:'rgba',outputPixelFormat:decodedFormat,
    codecArgs:['-c:v',name,...Object.entries(values).filter(([,v])=>v!==undefined).flatMap(([key,value])=>['-'+key,String(value)])],
    pixelFormatArgs:['-pix_fmt',inputFormat],colorArgs:[...COLOR_ARGS],quality:values,
    ignoredOptions,notes:depth===10?[TEN_BIT_NOTES[0],TEN_BIT_NOTES[1],'10-bit 输出的兼容性和编码成本取决于编码器；输入及色彩流程仍为 BT.709 SDR。']:[],warnings:known?[]:[`${name} has no built-in preset; only explicitly supplied encoding options are used. FFmpeg validates availability at runtime.`],paddingUnit:null};
}

function validateEncoderOptions(options){
  if(options===null||typeof options!=='object'||Array.isArray(options))throw new EncodingError('encoder-options must be a JSON object.',{code:'INVALID_OPTION'});
  for(const [key,value] of Object.entries(options)){
    if(!/^[a-zA-Z][a-zA-Z0-9_-]*(?::[a-zA-Z0-9_:]+)?$/.test(key)||['i','y','n','c','c:v','codec','vcodec','pix_fmt','s','s:v','r','r:v','t','frames:v','f','map','an','vn','filter_complex','filter_script','vf'].includes(key))throw new EncodingError(`encoder-options cannot set ${show(key)}; use the renderer's corresponding option.`,{code:'INVALID_OPTION'});
    if(!['string','number','boolean'].includes(typeof value)||String(value).trim()===''||(typeof value==='number'&&!Number.isFinite(value)))throw new EncodingError(`Invalid encoder-options value for ${key}.`,{code:'INVALID_OPTION'});
  }
  return Object.fromEntries(Object.entries(options).map(([key,value])=>[key,typeof value==='boolean'?(value?'1':'0'):String(value)]));
}

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
    if(name!==encoder&&REGISTRY[name]?.bitDepths[bitDepth])hints.push(`--encoder ${name} --bit-depth ${bitDepth}`);
  }
  for(const depth of Object.keys(REGISTRY[encoder].bitDepths).map(Number)){
    if(depth!==bitDepth)hints.push(`--encoder ${encoder} --bit-depth ${depth}`);
  }
  return hints;
}

export function resolveEncoding({encoder='libx264',bitDepth=8,overrides={},encoderOptions={},pixelFormat}={}){
  const name=typeof encoder==='string'?encoder.trim():String(encoder??'');
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name))throw new EncodingError(`Invalid encoder name ${show(encoder)}.`,{code:'INVALID_ENCODER'});
  const options=validateEncoderOptions(encoderOptions);
  if(pixelFormat!==undefined&&!/^[a-z0-9_]+$/.test(pixelFormat))throw new EncodingError('Invalid pixel-format.',{code:'INVALID_OPTION'});
  const spec=REGISTRY[name];
  if(!spec){
    const depth=parseBitDepth(bitDepth);
    if(depth===null)throw new EncodingError('Unsupported bit depth; allowed values: 8, 10.',{code:'INVALID_BIT_DEPTH'});
    if(overrides===null||typeof overrides!=='object'||Array.isArray(overrides))throw new EncodingError('overrides must be an object.',{code:'INVALID_OPTION'});
    return flexibleEncoding(name,depth,overrides,options,pixelFormat);
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
  for(const [key,value] of Object.entries(options)){
    const index=codecArgs.indexOf('-'+key);
    if(index>=0)codecArgs[index+1]=value;
    else codecArgs.push('-'+key,value);
  }

  return{
    encoder:name,
    family:spec.family,
    backend:spec.backend,
    bitDepth:depth,
    inputPixelFormat:'rgba',
    outputPixelFormat:pixelFormat??outputPixelFormat,
    codecArgs,
    pixelFormatArgs:['-pix_fmt',pixelFormat??outputPixelFormat],
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
    'stream=codec_name,profile,pix_fmt,width,height,bits_per_raw_sample,avg_frame_rate:stream_side_data=side_data_type,crop_top,crop_bottom,crop_left,crop_right','-of','json',target];
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
  const cropping=stream.side_data_list?.find(item=>item.side_data_type==='Frame Cropping')??{};
  const crop={};
  for(const edge of ['top','bottom','left','right']){
    const value=cropping['crop_'+edge]??0;
    if(!Number.isInteger(value)||value<0)return{verified:false,detail:'Invalid container cropping metadata.',pixelFormat:null};
    crop[edge]=value;
  }
  return{
    verified:typeof stream.pix_fmt==='string'&&stream.pix_fmt!=='',
    pixelFormat:stream.pix_fmt??null,
    codecName:stream.codec_name??null,
    profile:stream.profile??null,
    width:stream.width??null,
    height:stream.height??null,
    displayWidth:stream.width===undefined?null:stream.width-crop.left-crop.right,
    displayHeight:stream.height===undefined?null:stream.height-crop.top-crop.bottom,
    cropping:crop,
    averageFrameRate:stream.avg_frame_rate??null,
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
