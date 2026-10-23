import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveEncoding} from '../encoding.mjs';

test('software AV1 defaults use quality control without a target bitrate',()=>{
  const svt=resolveEncoding({encoder:'libsvtav1'});
  assert.equal(svt.family,'av1');
  assert.deepEqual(svt.codecArgs,['-c:v','libsvtav1','-preset','6','-crf','28']);
  assert.equal(svt.codecArgs.includes('-b:v'),false);
  assert.equal(resolveEncoding({encoder:'libsvtav1',overrides:{crf:63}}).quality.crf,'63');
  assert.throws(()=>resolveEncoding({encoder:'libsvtav1',overrides:{crf:64}}));
});

test('NVENC and QSV accept CPU frames in their supported input layouts',()=>{
  for(const encoder of ['h264_nvenc','hevc_nvenc','av1_nvenc','h264_qsv','hevc_qsv','av1_qsv']){
    const plan=resolveEncoding({encoder});
    assert.equal(plan.backend,'gpu');
    assert.deepEqual(plan.pixelFormatArgs,['-pix_fmt','nv12']);
    assert.equal(plan.outputPixelFormat,'yuv420p');
    assert.equal(plan.codecArgs.includes('-crf'),false);
    const bitrate=resolveEncoding({encoder,overrides:{bitrate:'8M'}});
    assert.ok(bitrate.codecArgs.includes('8M'));
    assert.equal(bitrate.codecArgs.includes('-global_quality'),false);
    assert.equal(bitrate.codecArgs.includes('-qp'),false);
  }
  for(const encoder of ['hevc_qsv','av1_qsv','hevc_nvenc','av1_nvenc']){
    const plan=resolveEncoding({encoder,bitDepth:10});
    assert.equal(plan.outputPixelFormat,'yuv420p10le');
    assert.deepEqual(plan.pixelFormatArgs,['-pix_fmt','p010le']);
  }
});

test('encoder options override defaults without shell parsing or duplicate flags',()=>{
  const plan=resolveEncoding({encoder:'av1_nvenc',encoderOptions:{preset:'p6',qp:20}});
  assert.equal(plan.codecArgs.filter(v=>v==='-preset').length,1);
  assert.ok(plan.codecArgs.includes('p6'));
  const custom=resolveEncoding({encoder:'ffv1',pixelFormat:'yuv444p',encoderOptions:{level:3}});
  assert.deepEqual(custom.codecArgs,['-c:v','ffv1','-level','3']);
  assert.deepEqual(custom.pixelFormatArgs,['-pix_fmt','yuv444p']);
  for(const encoderOptions of [null,[],{i:'other.mp4'},{'c:v':'libx264'},{qp:null},{qp:Infinity}]){
    assert.throws(()=>resolveEncoding({encoder:'ffv1',encoderOptions}));
  }
});
