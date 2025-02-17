export function convertAccount (acc) {
  switch (acc.type) {
    case 'deposit':
      let start = getDate(acc.details.match(/Дата открытия:\s(.[0-9.]*)/i)[1])
      let stop = getDate(acc.details.match(/Срок возврата вклада:\s(.[0-9.]*)/i)[1])
      let depositDays = (stop - start) / 60 / 60 / 24 / 1000
      return {
        id: acc.id,
        type: 'deposit',
        title: acc.name,
        instrument: acc.currency,
        balance: Number.parseFloat(acc.balance.replace(/\s/g, '')),
        syncID: [acc.id],
        capitalization: true,
        percent: Number.parseFloat(acc.details.match(/Процентная ставка:.*\s(.[0-9]*)%/i)[1]),
        startDate: start,
        endDateOffset: depositDays,
        endDateOffsetInterval: 'day',
        payoffStep: 1,
        payoffInterval: 'month'
      }
    case 'card':
      return {
        id: acc.id.replace(/\s/g, ''),
        type: 'card',
        title: 'Карта ' + acc.cardNum.slice(-4),
        instrument: acc.currency,
        balance: Number.parseFloat(acc.balance.replace(/\s/g, '')),
        syncID: [acc.id.replace(/\s/g, ''), acc.cardNum.slice(-4)],
        raw: acc
      }
  }
}

export function convertTransaction (tr, accounts) {
  console.log(tr)
  const account = accounts.find(account => {
    return account.syncID.indexOf(tr.accountID) !== -1
  })

  const transaction = {
    date: getFullDate(tr.date + ' ' + tr.time),
    movements: [ getMovement(tr, account) ],
    merchant: null,
    comment: null,
    hold: tr.status !== 'operResultOk'
  };

  [
    parseCash,
    parsePayee
  ].some(parser => parser(transaction, tr))

  return transaction
}

function getMovement (tr, account) {
  const movement = {
    id: null,
    account: { id: account.id },
    invoice: null,
    sum: getSumAmount(tr.debitFlag, tr.operationSum),
    fee: 0
  }

  if (tr.operationCurrency !== account.instrument) {
    movement.invoice = {
      sum: getSumAmount(tr.debitFlag, tr.inAccountSum),
      instrument: tr.operationCurrency
    }
  }

  return movement
}

function parseCash (transaction, tr) {
  if (tr.comment.indexOf('Пополнение счета') >= 0) {
    // добавим вторую часть перевода
    transaction.movements.push({
      id: null,
      account: {
        company: null,
        type: 'cash',
        instrument: tr.operationCurrency,
        syncIds: null
      },
      invoice: null,
      sum: -getSumAmount(tr.debitFlag, tr.operationSum),
      fee: 0
    })
    return true
  }
}

function parsePayee (transaction, tr) {
  // интернет-платежи отображаем без получателя
  if (!tr.place) {
    return false
  }

  let data = tr.place.split('/')
  if (data.length === 0) {
    return false
  }
  /* transaction.merchant = {
    mcc: data[1] !== '' ? Number.parseInt(data[1]) : null,
    location: null,
    fullTitle: ''
  } */ // Пока мало инфы, чтоб парсить
  transaction.comment = data[0]
}

function getSumAmount (debitFlag, strAmount) {
  const amount = Number.parseFloat(strAmount.replace(/\s/g, ''))
  return debitFlag === '+' ? amount : -amount
}

function getDate (str) {
  const [day, month, year] = str.match(/(\d{2}).(\d{2}).(\d{4})/).slice(1)
  return new Date(`${year}-${month}-${day}T00:00:00+03:00`)
}

export function getFullDate (str) {
  const [day, month, year, hour, minute, second] = str.match(/(\d{2}).(\d{2}).(\d{4}) (\d{2}):(\d{2}):(\d{2})/).slice(1)
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+03:00`)
}
