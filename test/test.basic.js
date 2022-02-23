function AnyJob (defer) {
  qlib.JobBase.call(this, defer);
}
lib.inherit(AnyJob, qlib.JobBase);
AnyJob.prototype.go = function () {
  var ok = this.okToGo();
  if (!ok.ok) {
    return ok.val;
  }
  lib.runNext(this.onOkToGo.bind(this));
  return ok.val;
};
AnyJob.prototype.onOkToGo = function () {
  throw new lib.Error('NOT_IMPLEMENTED', 'onOkToGo hast to be implemented by '+this.constructor.name);
};

function TickingJob (defer) {
  AnyJob.call(this, defer);
}
lib.inherit(TickingJob, AnyJob);
TickingJob.prototype.onOkToGo = function () {
  lib.runNext(this.doTick.bind(this), Math.round(15+Math.random()*15));
};
TickingJob.prototype.doTick = function () {
  globalTick();
  this.resolve(true);
};

function SpecialJob (expectedglobalcountervalue, defer) {
  AnyJob.call(this, defer);
  this.expectedglobalcountervalue = expectedglobalcountervalue;
}
lib.inherit(SpecialJob, AnyJob);
SpecialJob.prototype.destroy = function () {
  this.expectedglobalcountervalue = null;
  AnyJob.prototype.destroy.call(this);
};
SpecialJob.prototype.resolve = function (thingy) {
  if (this.expectedglobalcountervalue != _globalCnt) {
    this.reject(new lib.Error('INEQUAL', this.expectedglobalcountervalue+'<>'+_globalCnt));
    return;
  }
  return AnyJob.prototype.resolve.call(this, thingy);
}
SpecialJob.prototype.onOkToGo = function () {
  if (this.expectedglobalcountervalue != _globalCnt) {
    this.reject(new lib.Error('INEQUAL', this.expectedglobalcountervalue+'<>'+_globalCnt));
    return;
  }
  lib.runNext(this.resolve.bind(this, "Thats' what I say"), Math.round(150+Math.random()*150));
};


var _globalCnt = 0;
var _globalCntEvent = new lib.HookCollection();
function globalTick () {
  _globalCnt++;
  _globalCntEvent.fire(_globalCnt);
}

function GlobalCntValueWaiterJob (expectedval, defer) {
  AnyJob.call(this, defer);
  this.expectedval = expectedval;
  this.globalCountEventListener = null;
}
lib.inherit(GlobalCntValueWaiterJob, AnyJob);
GlobalCntValueWaiterJob.prototype.destroy = function () {
  if (this.globalCountEventListener) {
    this.globalCountEventListener.destroy();
  }
  this.globalCountEventListener = null;
  this.expectedval = null;
  AnyJob.prototype.destroy.call(this);
};
GlobalCntValueWaiterJob.prototype.onOkToGo = function () {
  if (this.expectedval<=_globalCnt) {
    this.resolve(true);
    return;
  }
  this.globalCountEventListener = _globalCntEvent.attach(this.onGlobalCount.bind(this));
};
GlobalCntValueWaiterJob.prototype.onGlobalCount = function (cnt) {
  if (this.expectedval<=cnt) {
    this.resolve(true);
    return;
  }
};

function waitForGlobalCountValue (val) {
  return (new GlobalCntValueWaiterJob(val)).go();
}

describe('Test JobCollection Locking', function () {
  it('Load Lib', function () {
    return setGlobal('Lib', require('../')(execlib));
  });
  it('Make Q', function () {
    return setGlobal('Q', new qlib.JobCollection());
  });
  it('Put 3 tickers on Q', function () {
    Q.run('a', new TickingJob());
    Q.run('b', new TickingJob());
    Q.run('c', new TickingJob());
  });
  it('Put LockJob on Q', function () {
    qlib.promise2console(Lib.runLockedOn(Q, 'b', new SpecialJob(3)), 'LockJob says');
  });
  it('Put 3 tickers on Q', function () {
    Q.run('a', new TickingJob());
    Q.run('b', new TickingJob());
    Q.run('c', new TickingJob());
  });
  it('Wait for GlobalCounter 6', function () {
    return waitForGlobalCountValue(6);
  })
  it('Destroy Q', function() {
    Q.destroy();
  })
});