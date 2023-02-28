/**
 * Slack project is configured in Slack.
 * To add a new endpoint, go to 'Incoming Webhook' settings in the project
 * and select a new Slack channel to which to send updates.
 * All security-sensitive variables are in Options.gs
 */
function sendSlackAlert(proj_data, longest) {
  const payload = buildSlackMessage(proj_data, longest);

  var options = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: false,
    payload: JSON.stringify(payload),
  };

  try {
    let dow = new Date().getDay();
    if (dow != 6 && dow != 0) {
      // don't send on weekends
      UrlFetchApp.fetch(webhookOptions.webhookEndpoint, options); // endpoint in Options.gs
    }
  } catch (e) {
    Logger.log(e);
  }
}

function buildSlackMessage(projects, longest) {
  let project_statuses = projects.map((proj) =>
    buildSlackProjectBlock(proj.name, proj.id, proj.owed, proj.worked, proj.pctDone, longest)
  );

  let msg = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':alarm_clock:  Toggl Project Status :alarm_clock:',
          emoji: true,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*<https://track.toggl.com/timer|Show Toggl>*',
        },
      },
    ],
  };
  for (let len = project_statuses.length - 1, i = len; i >= 0; --i) {
    msg.blocks.splice(2, 0, project_statuses[i]);
  }
  // console.log(msg);
  return msg;
}

function formatCompletionMsg(name, id, est, worked, pct) {
  let msg = `*${name}*  ${worked}/${est}h *(${pct}%)*`;
  if (est == 0) {
    msg = `*${name}*  worked ${worked}h`;
  }
  return msg;
}
function buildSlackProjectBlock(project_name, project_id, est_h, total_h, pct_complete, longest) {
  const proj_text = formatCompletionMsg(
    project_name,
    project_id,
    est_h,
    total_h,
    pct_complete,
    longest
  );
  // console.log(proj_text);
  var block = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${proj_text}`,
    },
    accessory: {
      type: 'button',
      text: {
        type: 'plain_text',
        emoji: true,
        text: 'Toggl Report',
      },
      url: togglOptions.reportUrl + project_id,
    },
  };
  //console.log(block);
  return block;
}

function zeroNotNull(value) {
  return value ? value : 0;
}

function timerSendUpdates(e) {
  const toggl_config = {
    contentType: 'application/json',
    headers: {
      Authorization: togglOptions.basicAuth,
    },
  };
  let url = [
    'https://api.track.toggl.com/api/v9/workspaces/',
    togglOptions.workspaceId,
    '/projects?active=true',
  ].join('');

  let response = UrlFetchApp.fetch(url, toggl_config),
    projs = [],
    longest = 0;
  const json = JSON.parse(response.getContentText());

  var projects = json.filter((proj) => {
    //console.log(proj);
    if (!proj['template'] && !(proj['name'].indexOf('TL') === 0)) {
      const name = proj['name'];
      const owed = zeroNotNull(proj['estimated_hours']);
      const worked = zeroNotNull(proj['actual_hours']);
      longest = name.length > longest ? name.length : longest;
      let total = Math.round(owed ? (worked / owed) * 100 : 100);
      projs.push({
        name: name,
        id: proj.id,
        owed: owed,
        worked: worked,
        pctDone: total,
      });
      return true;
    }
  });
  // console.log(projs);
  sendSlackAlert(projs, longest);
}
