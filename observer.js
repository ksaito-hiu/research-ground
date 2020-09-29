/*
 * file_appからの情報を受け取り色々処理する関数
 */
const init = function(rg) {
  // 上記引数のrgはresearch-groundのインスタンス。rg.configで設定、
  // rg.colCoursesなどでMongoDBのcollectionにアクセスできる。

  return async function(uid,action,data) {
    const utime = new Date().getTime();
    if (!data) data = {};
    const t = typeof(data);
    if (t==='string' || t==='number' || t==='boolean') data = {data};
    data.uid = uid;
    data.action = action;
    data.utime = utime;
    console.log("observer: "+JSON.stringify(data));
    await rg.colActions.insertOne(data);

    // 学生のファイル操作によって課題の採点情報に記録を残す
    if (data.action==='file_upload') {
      const courses = await colStudents.find({account:uid}).toArray();
      for (c of courses) {
        const e = await colExcercises.findOne({course: c.course, submit:data.path});
        if (e) {
          const m = await colMarks.findOne({excercise:e._id,student:uid});
          if (m) {
            m.status = 'resubmitted';
            await colMarks.updateOne({excercise:e._id,student:uid},{$set:m});
          } else {
            const new_m = {
              excercise:e._id,
              student:uid,
              status:'submitted',
              mark:0,
              feedbacks:[]
            };
            await colMarks.insertOne(new_m);
          }
          break;
        }
      }
    } else if (data.action==='file_remove') {
    }
  }
};

module.exports = init;
