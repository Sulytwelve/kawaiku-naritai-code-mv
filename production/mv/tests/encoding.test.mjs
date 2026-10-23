import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {EncodingError,SUPPORTED_ENCODERS,resolveEncoding,probeEncoder,parseSupportedPixelFormats,probeEncoderPixels,probeOutputPixelFormat} from '../encoding.mjs';

const COLOR_ARGS=['-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709'];

function fails(fn,code,pattern){
  let error=null;
  try{fn()}catch(e){error=e}
  assert.ok(error instanceof EncodingError,`expected EncodingError, got ${error}`);
  assert.equal(error.code,code);
  if(pattern)assert.match(error.message,pattern);
  return error;
}

test('defaults: libx264 8-bit with preset/crf',()=>{
  assert.deepEqual(resolveEncoding(),{
    encoder:'libx264',family:'h264',backend:'cpu',bitDepth:8,
    inputPixelFormat:'rgba',outputPixelFormat:'yuv420p',
    codecArgs:['-c:v','libx264','-preset','fast','-crf','19'],
    pixelFormatArgs:['-pix_fmt','yuv420p'],
    colorArgs:COLOR_ARGS,
    quality:{preset:'fast',crf:'19'},
    ignoredOptions:[],notes:[],warnings:[],paddingUnit:null,
  });
  assert.deepEqual(resolveEncoding({width:320,height:180}),resolveEncoding());
  assert.deepEqual(resolveEncoding({bitDepth:'8'}).codecArgs,['-c:v','libx264','-preset','fast','-crf','19']);
});

test('av1_amf: 8-bit yuv420p, -quality/-b:v, padding unit 16',()=>{
  assert.deepEqual(resolveEncoding({encoder:'av1_amf'}),{
    encoder:'av1_amf',family:'av1',backend:'gpu',bitDepth:8,
    inputPixelFormat:'rgba',outputPixelFormat:'yuv420p',
    codecArgs:['-c:v','av1_amf','-quality','balanced','-b:v','24M'],
    pixelFormatArgs:['-pix_fmt','yuv420p'],
    colorArgs:COLOR_ARGS,
    quality:{quality:'balanced',bitrate:'24M'},
    ignoredOptions:[],notes:[],warnings:[],paddingUnit:16,
  });
  const custom=resolveEncoding({encoder:'av1_amf',overrides:{quality:'quality',bitrate:'50M'}});
  assert.deepEqual(custom.codecArgs,['-c:v','av1_amf','-quality','quality','-b:v','50M']);
  assert.deepEqual(custom.quality,{quality:'quality',bitrate:'50M'});
  assert.equal(custom.paddingUnit,16);
  assert.equal(resolveEncoding({encoder:'libx265',bitDepth:8}).paddingUnit,null);
});

test('10-bit route: libx265 + yuv420p10le, input stays rgba',()=>{
  const r=resolveEncoding({encoder:'libx265',bitDepth:10,overrides:{preset:'medium',crf:24}});
  assert.equal(r.family,'hevc');
  assert.equal(r.backend,'cpu');
  assert.equal(r.bitDepth,10);
  assert.equal(r.inputPixelFormat,'rgba');
  assert.equal(r.outputPixelFormat,'yuv420p10le');
  assert.deepEqual(r.codecArgs,['-c:v','libx265','-preset','medium','-crf','24']);
  assert.deepEqual(r.quality,{preset:'medium',crf:'24'});
  assert.deepEqual(r.pixelFormatArgs,['-pix_fmt','yuv420p10le']);
  assert.ok(r.notes.length>=2);
  const notes=r.notes.join(' ');
  assert.match(notes,/色阶/);
  assert.match(notes,/端到端/);
  assert.match(notes,/兼容性/);
  assert.match(notes,/成本/);

  const defaults=resolveEncoding({encoder:'libx265',bitDepth:'10'});
  assert.deepEqual(defaults.codecArgs,['-c:v','libx265','-preset','fast','-crf','19']);
  assert.equal(defaults.bitDepth,10);
  const eight=resolveEncoding({encoder:'libx265',bitDepth:8});
  assert.equal(eight.outputPixelFormat,'yuv420p');
  assert.deepEqual(eight.notes,[]);
});

test('invalid bit depth is rejected with allowed values',()=>{
  for(const value of [9,12,'9','abc','',null,8.5]){
    const error=fails(()=>resolveEncoding({bitDepth:value}),'INVALID_BIT_DEPTH');
    assert.match(error.message,/8, 10/);
  }
  const nine=fails(()=>resolveEncoding({bitDepth:9}),'INVALID_BIT_DEPTH');
  assert.match(nine.message,/9/);
});

test('malformed encoder names are rejected without libx264 fallback',()=>{
  for(const encoder of ['','-bad','bad name',null]){
    const error=fails(()=>resolveEncoding({encoder}),'INVALID_ENCODER');
    assert.doesNotMatch(error.message,/-preset|-crf/);
  }
  const custom=resolveEncoding({encoder:'libvpx-vp9',encoderOptions:{deadline:'good'}});
  assert.deepEqual(custom.codecArgs,['-c:v','libvpx-vp9','-deadline','good']);
  assert.ok(SUPPORTED_ENCODERS.includes('av1_qsv'));
  assert.ok(SUPPORTED_ENCODERS.includes('av1_nvenc'));
});

test('incompatible encoder/bit-depth combinations offer alternatives',()=>{
  for(const encoder of ['libx264','av1_amf']){
    const error=fails(()=>resolveEncoding({encoder,bitDepth:10}),'UNSUPPORTED_COMBINATION');
    assert.match(error.message,/--encoder libx265 --bit-depth 10/);
    assert.match(error.message,new RegExp(`--encoder ${encoder} --bit-depth 8`));
    assert.deepEqual(error.details.alternatives,['--encoder libx265 --bit-depth 10',`--encoder ${encoder} --bit-depth 8`]);
  }
});

test('explicit options the encoder ignores become ignoredOptions + warnings',()=>{
  const x264=resolveEncoding({encoder:'libx264',overrides:{bitrate:'30M',quality:'slow'}});
  assert.deepEqual(x264.ignoredOptions,['quality','bitrate']);
  assert.equal(x264.warnings.length,1);
  assert.match(x264.warnings[0],/-quality/);
  assert.match(x264.warnings[0],/-b:v/);
  assert.deepEqual(x264.quality,{preset:'fast',crf:'19'});
  assert.deepEqual(x264.codecArgs,['-c:v','libx264','-preset','fast','-crf','19']);

  const amf=resolveEncoding({encoder:'av1_amf',overrides:{preset:'slow',crf:18}});
  assert.deepEqual(amf.ignoredOptions,['preset','crf']);
  assert.equal(amf.warnings.length,1);
  assert.match(amf.warnings[0],/-preset/);
  assert.match(amf.warnings[0],/-crf/);
  assert.deepEqual(amf.codecArgs,['-c:v','av1_amf','-quality','balanced','-b:v','24M']);

  // A value that would be invalid for another encoder is merely ignored here.
  const ignoredBadCrf=resolveEncoding({encoder:'av1_amf',overrides:{crf:999}});
  assert.deepEqual(ignoredBadCrf.ignoredOptions,['crf']);
});

test('crf, preset and bitrate validation',()=>{
  for(const crf of [-1,52,19.5,'19.5','abc','']){
    fails(()=>resolveEncoding({overrides:{crf}}),'INVALID_OPTION',/0 and 51/);
  }
  for(const preset of ['','   ',5,null]){
    fails(()=>resolveEncoding({overrides:{preset}}),'INVALID_OPTION',/non-empty string/);
  }
  for(const bitrate of ['','fast','24Mi','1.5MB']){
    fails(()=>resolveEncoding({encoder:'av1_amf',overrides:{bitrate}}),'INVALID_OPTION',/[kKmM]/);
  }

  assert.equal(resolveEncoding({overrides:{crf:0}}).quality.crf,'0');
  assert.equal(resolveEncoding({overrides:{crf:51}}).quality.crf,'51');
  assert.equal(resolveEncoding({overrides:{preset:'veryfast'}}).quality.preset,'veryfast');
  assert.equal(resolveEncoding({encoder:'av1_amf',overrides:{bitrate:'1.5M'}}).quality.bitrate,'1.5M');
  assert.equal(resolveEncoding({encoder:'av1_amf',overrides:{bitrate:'256k'}}).quality.bitrate,'256k');
});

test('probeEncoder: unstartable ffmpeg resolves listed:false without throwing',async()=>{
  const missing=path.join(os.tmpdir(),`kawaiku-missing-ffmpeg-${process.pid}-${Date.now()}.exe`);
  const result=await probeEncoder(missing,'libx264',{timeoutMs:5000});
  assert.equal(result.listed,false);
  assert.equal(result.scope,'encoders-list');
  assert.equal(result.exitCode,null);
  assert.equal(typeof result.detail,'string');
  assert.match(result.detail,/Cannot start/);
  assert.ok(result.stderrTail===null||typeof result.stderrTail==='string');
});

test('probeEncoder: real ffmpeg lists libx264',async t=>{
  const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
  const version=spawnSync(ffmpeg,['-hide_banner','-version'],{stdio:'ignore',windowsHide:true});
  if(version.error||version.status!==0){
    t.skip(`${ffmpeg} is not available`);
    return;
  }
  const result=await probeEncoder(ffmpeg,'libx264',{timeoutMs:15000});
  assert.equal(result.listed,true);
  assert.equal(result.scope,'encoders-list');
  assert.equal(result.exitCode,0);
  assert.match(result.detail,/列表存在不等于硬件初始化成功/);

  const absent=await probeEncoder(ffmpeg,'definitely_not_an_encoder',{timeoutMs:15000});
  assert.equal(absent.listed,false);
  assert.equal(absent.scope,'encoders-list');
});

test('parseSupportedPixelFormats: reads wrapped lists and stops at the next section',()=>{
  const help=[
    '    Encoder libx265 [libx265 H.265 / HEVC]:',
    '    General capabilities: dr1 delay threads',
    '    Threading capabilities: frame',
    '    Supported pixel formats: yuv420p yuvj420p yuv422p',
    '      yuv420p10le yuv422p10le gbrp10le',
    '  libx265 AVOptions:',
    '    -crf <float> set the x265 crf',
  ].join('\n');
  assert.deepEqual(parseSupportedPixelFormats(help),['yuv420p','yuvj420p','yuv422p','yuv420p10le','yuv422p10le','gbrp10le']);
  assert.deepEqual(parseSupportedPixelFormats('no pixel list here'),[]);
  assert.deepEqual(parseSupportedPixelFormats(null),[]);
});

test('probeEncoderPixels: unstartable ffmpeg resolves an empty list without throwing',async()=>{
  const missing=path.join(os.tmpdir(),`kawaiku-missing-ffmpeg-pix-${process.pid}-${Date.now()}.exe`);
  const result=await probeEncoderPixels(missing,'libx265',{timeoutMs:5000});
  assert.deepEqual(result.supported,[]);
  assert.equal(result.pixelFormatListRead,false);
  assert.match(result.detail,/Cannot run/);
});

test('probeEncoderPixels: real ffmpeg lists the 10-bit format for libx265',async t=>{
  const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
  const version=spawnSync(ffmpeg,['-hide_banner','-version'],{stdio:'ignore',windowsHide:true});
  if(version.error||version.status!==0){
    t.skip(`${ffmpeg} is not available`);
    return;
  }
  const result=await probeEncoderPixels(ffmpeg,'libx265',{timeoutMs:15000});
  assert.equal(result.pixelFormatListRead,true);
  assert.ok(result.supported.includes('yuv420p10le'),`missing yuv420p10le in ${result.supported.join(' ')}`);
  const x264=await probeEncoderPixels(ffmpeg,'libx264',{timeoutMs:15000});
  assert.equal(x264.pixelFormatListRead,true);
  assert.ok(x264.supported.includes('yuv420p'));
});

test('probeOutputPixelFormat: a missing file is reported as unverified, not thrown',async()=>{
  const missing=path.join(os.tmpdir(),`kawaiku-missing-output-${process.pid}-${Date.now()}.mp4`);
  const result=await probeOutputPixelFormat(missing,{timeoutMs:10000});
  assert.equal(result.verified,false);
  assert.equal(result.pixelFormat,null);
  assert.equal(typeof result.detail,'string');
});

test('probeOutputPixelFormat: real ffmpeg output reports its pixel format',async t=>{
  const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
  const version=spawnSync(ffmpeg,['-hide_banner','-version'],{stdio:'ignore',windowsHide:true});
  if(version.error||version.status!==0){
    t.skip(`${ffmpeg} is not available`);
    return;
  }
  const file=path.join(os.tmpdir(),`kawaiku-probe-output-${process.pid}-${Date.now()}.mp4`);
  const encoded=spawnSync(ffmpeg,['-hide_banner','-y','-f','lavfi','-i','color=c=red:s=32x18:d=0.1:r=10',
    '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',file],{stdio:'ignore',windowsHide:true});
  if(encoded.status!==0){
    t.skip('ffmpeg could not produce a probe fixture');
    return;
  }
  try{
    const result=await probeOutputPixelFormat(file,{timeoutMs:15000});
    assert.equal(result.verified,true);
    assert.equal(result.pixelFormat,'yuv420p');
    assert.equal(result.codecName,'h264');
  }finally{
    fs.rmSync(file,{force:true});
  }
});
