function createLockingJob (execlib, mylib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    JobBase = qlib.JobBase;

  function ExecJobRelatedJob (execjob, defer) {
    JobBase.call(this, defer);
    this.execjob = execjob;
    this.running = false;
  }
  lib.inherit(ExecJobRelatedJob, JobBase);
  ExecJobRelatedJob.prototype.destroy = function () {
    this.running = null;
    this.execjob = null;
    JobBase.prototype.destroy.call(this);
  };
  ExecJobRelatedJob.prototype.go = function () {
    var ok = this.okToGo();
    if (!ok.ok) {
      return ok.val;
    }
    this.running = true;
    lib.runNext(this.onOkToGo.bind(this));
    return ok.val;
  };
  ExecJobRelatedJob.prototype.onOkToGo = function () {
    throw new lib.Error('NOT_IMPLEMENTED', 'onOkToGo hast to be implemented by '+this.constructor.name);
  };
  ExecJobRelatedJob.prototype.alreadyRunningError = function () {
    return new lib.Error('ALREADY_RUNNING', '')
  }

  function LockJob (execjob, defer) {
    ExecJobRelatedJob.call(this, execjob, defer);
    this.index = null;
  }
  lib.inherit(LockJob, ExecJobRelatedJob);
  LockJob.prototype.destroy = function () {
    this.index = null;
    ExecJobRelatedJob.prototype.destroy.call(this);
  };
  LockJob.prototype.setIndex = function (index) {
    if (this.running) {
      throw this.alreadyRunningError();
    }
    this.index = index;
  };
  LockJob.prototype.onOkToGo = function () {
    qlib.promise2defer(this.execjob.defer.promise, this);
    this.notify(this.index);
  };


  function JobRunner (execjob, defer) {
    ExecJobRelatedJob.call(this, execjob, defer);
    this.lockjobs = [];
  }
  lib.inherit(JobRunner, ExecJobRelatedJob);
  JobRunner.prototype.destroy = function () {
    this.lockjobs = null;
    ExecJobRelatedJob.prototype.destroy.call(this);
  };
  JobRunner.prototype.onOkToGo = function () {};
  JobRunner.prototype.addLockJob = function (lockjob) {
    if (this.running) {
      throw this.alreadyRunningError();
    }
    if (!lib.isArray(this.lockjobs)) {
      throw new lib.Error('ALREADY_DESTROYED', 'This instance of '+this.constructor.name+' is already destroyed');
    }
    lockjob.setIndex(this.lockjobs.length);
    this.lockjobs.push(lockjob);
    lockjob.defer.promise.then(null, null, this.onLockJob.bind(this));
  };
  JobRunner.prototype.onLockJob = function (index) {
    if (!lib.isArray(this.lockjobs)) {
      return;
    }
    if (!this.lockjobs[index]) {
      return;
    }
    this.lockjobs[index] = null;
    if (this.noMoreLockJobs()) {
      qlib.promise2defer(this.execjob.go(), this);
    }
  };
  JobRunner.prototype.noMoreLockJobs = function () {
    if (!lib.isArray(this.lockjobs)) {
      return true;
    }
    return this.lockjobs.every(function (lj) {return !lj;});
  };


  mylib.runLockedOn = function (jobs, jobchannelname, jobinstance, jobchannelstolock) {
    var jr = new JobRunner(jobinstance);
    if (lib.isArray(jobchannelstolock)) {
      jobchannelstolock.forEach(lockerViaArry.bind(null, jobs, jr, jobchannelname));
    } else {
      jobs.__locks.traverse(lockerViaMap.bind(null, jobs, jr, jobchannelname));
    }
    return jobs.run(jobchannelname, jr);
  };

  function lockerViaArry (jobs, jobrunner, skipchannelname, jobchannelname) {
    var lj;
    if (skipchannelname == jobchannelname) {
      return;
    }
    lj = new LockJob(jobrunner);
    jobrunner.addLockJob(lj);
    jobs.run(jobchannelname, lj);
  }
  function lockerViaMap (jobs, jobrunner, skipchannelname, channelignored, jobchannelname) {
    lockerViaArry(jobs, jobrunner, skipchannelname, jobchannelname);
  }
}
module.exports = createLockingJob;
