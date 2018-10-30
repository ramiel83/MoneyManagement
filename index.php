<?php
// headers: first things before anything else.
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

// connect to the mysql database.
$opt = array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION);
//$pdo = new PDO('mysql:dbname=moneymanagement;host=localhost;charset=utf8', 'root', '1234', $opt);
$pdo = new PDO('mysql:dbname=moneymanagement;host=us-cdbr-azure-central-a.cloudapp.net;charset=utf8', 'b16af420cdd09f', '3da76c6c', $opt);

// each action in this page, has a function. after we take the $_GET['action'] we call the method.
$action = $_GET['action'];
$ret = $action($pdo);
// encode the response as json
echo json_encode($ret, JSON_UNESCAPED_UNICODE);

/**
 * check if the username / password given is in the database.
 * @param $pdo database connection
 * @return array user_id from the database if true
 */
function login($pdo)
{
    $username = $_GET['username'];
    $password = $_GET['password'];

    $stm = $pdo->prepare("select `id` from `users` where `username` = ? and `password` = ?");
    $stm->execute(array($username, $password));
    $data = $stm->fetch();
    if (empty($data)) {
        $user_id = null;
    } else {
        $user_id = $data[0];
    }

    return array('user_id' => $user_id);
}

/**
 * @param $pdo database connection
 * @return mixed the monthly, weekly, daily max spending of the given user.
 */
function get_max_spending_for_user($pdo)
{
    $user_id = $_GET['user_id'];

    $stm = $pdo->prepare("select `id`, `category_id`, `total_month`, `total_week`, `total_day` from `max_spending` where `user_id` = ?");
    $stm->execute(array($user_id));
    $data = $stm->fetchAll(PDO::FETCH_ASSOC);

    return $data;
}

/**
 * updates the monthly, weekly, daily max spending of the given id.
 * @param $pdo database connection
 * @return array
 */
function update_max_spending($pdo)
{
    $max_spending_id = $_GET['id'];
    $total_month = $_GET['total_month'];
    $total_week = $_GET['total_week'];
    $total_day = $_GET['total_day'];

    if ($total_day > $total_week) {
        return array('error' => "Total day must be smaller than total week");
    }
    if ($total_day > $total_month) {
        return array('error' => "Total day must be smaller than total month");
    }
    if ($total_week > $total_month) {
        return array('error' => "Total week must be smaller than total month");
    }

    $stm = $pdo->prepare("update `max_spending` set `total_month` = ?, `total_week` = ?, `total_day` = ? where `id` = ?");
    $success = $stm->execute(array($total_month, $total_week, $total_day, $max_spending_id));

    return array('updated' => $success);
}

/**
 * inserts a new transaction.
 * @param $pdo database connection
 * @return array inserted or not, if the user exceeded the max spending, there is the exceeded_msg
 */
function new_transaction($pdo)
{
    $user_id = $_GET['user_id'];
    $category_id = $_GET['category_id'];
    $total = $_GET['total'];
    $text = $_GET['text'];
    $datetime = $_GET['datetime'];

    $stm = $pdo->prepare("insert into `transactions` set `user_id` = ?, `category_id` = ?, `total` = ?, `text` = ?, `datetime` = ?");
    $success = $stm->execute(array($user_id, $category_id, $total, $text, $datetime));

    $exceeded_msg = check_if_exceeded($pdo, $user_id, $category_id);

    return array('inserted' => $success, 'exceeded_msg' => $exceeded_msg);
}

/**
 * check if the user/category exceeded max_spending
 * @param $pdo database connection
 * @param $user_id
 * @param $category_id
 * @return string messages if the the user exceeded
 */
function check_if_exceeded($pdo, $user_id, $category_id)
{
    $stm = $pdo->prepare("select `total_month`, `total_week`, `total_day` from `max_spending` where `user_id` = ? and `category_id` = ?");
    $stm->execute(array($user_id, $category_id));
    $max_data = $stm->fetch(PDO::FETCH_ASSOC);

    $errors = array();

    $daily_sum = get_transaction_sum($pdo, $user_id, $category_id, strtotime("midnight"), strtotime("tomorrow") - 1);
    if ($max_data['total_day'] < $daily_sum) {
        $errors[] = 'Exceeded daily Totals';
    }
    $weekly_sum = get_transaction_sum($pdo, $user_id, $category_id, strtotime('last sunday'), strtotime('this sunday') - 1);
    if ($max_data['total_week'] < $weekly_sum) {
        $errors[] = 'Exceeded Weekly Totals';
    }
    $monthly_sum = get_transaction_sum($pdo, $user_id, $category_id, strtotime('first day of ' . date('F Y')), strtotime('last day of ' . date('F Y')) + 60 * 60 * 24 - 1);
    if ($max_data['total_month'] < $monthly_sum) {
        $errors[] = 'Exceeded Monthly Totals';
    }

    return implode(', ', $errors);
}

/**
 * gets the total transactions sum of all the transaction of the user/category within the specified time-frame
 * @param $pdo
 * @param $user_id
 * @param $category_id
 * @param $from_date
 * @param $to_date
 * @return mixed total
 */
function get_transaction_sum($pdo, $user_id, $category_id, $from_date, $to_date)
{
    $stm = $pdo->prepare("select sum(`total`) from `transactions` where `user_id` = ? and `category_id` = ? and `datetime` > ? and `datetime` < ?");
    $stm->execute(array($user_id, $category_id, date("Y-m-d H:i:s", $from_date), date("Y-m-d H:i:s", $to_date)));
    $data = $stm->fetch();

    return $data[0];
}

/**
 * updates an existing transaction
 * @param $pdo
 * @return array inserted or not, if the user exceeded the max spending, there is the exceeded_msg
 */
function update_transaction($pdo)
{
    $id = $_GET['id'];
    $category_id = $_GET['category_id'];
    $total = $_GET['total'];
    $text = $_GET['text'];
    $datetime = $_GET['datetime'];

    $stm = $pdo->prepare("update `transactions` set `category_id` = ?, `total` = ?, `text` = ?, `datetime` = ? where `id` = ?");
    $success = $stm->execute(array($category_id, $total, $text, $datetime, $id));

    $user_id = get_user_from_transaction_id($pdo, $id);
    $exceeded_msg = check_if_exceeded($pdo, $user_id, $category_id);

    return array('updated' => $success, 'exceeded_msg' => $exceeded_msg);
}

/**
 * for a given transaction, get the user that entered it.
 * @param $pdo
 * @param $transaction_id
 * @return mixed
 */
function get_user_from_transaction_id($pdo, $transaction_id)
{
    $stm = $pdo->prepare("select `user_id` from `transactions` where `id` = ?");
    $stm->execute(array($transaction_id));
    $data = $stm->fetch();

    return $data[0];
}

/**
 * delete a transaction by transaction id.
 * @param $pdo
 * @return array delete success
 */
function delete_transaction($pdo)
{
    $id = $_GET['id'];

    $stm = $pdo->prepare("delete from `transactions` where `id` = ?");
    $success = $stm->execute(array($id));

    return array('deleted' => $success);
}

/**
 * returns the categories list - id and names
 * @param $pdo
 * @return mixed
 */
function categories_list($pdo)
{
    $stm = $pdo->prepare("select `id`, `name` from `categories`");
    $stm->execute();
    $data = $stm->fetchAll(PDO::FETCH_ASSOC);

    return $data;
}

/**
 * gets all the transactions (id, category_id, totals, text, datetime) of all the transactions according to the filters
 * @param $pdo
 * @return mixed
 */
function show_transactions($pdo)
{
    $user_id = $_GET['user_id'];
    $from_date = (isset($_GET['from_date']) and $_GET['from_date'] != '') ? $_GET['from_date'] : NULL;
    $to_date = (isset($_GET['to_date']) and $_GET['to_date'] != '') ? $_GET['to_date'] : NULL;
    $category_id = (isset($_GET['category_id']) and $_GET['category_id'] != '') ? $_GET['category_id'] : NULL;

    $stm = $pdo->prepare("select `id`, `category_id`, `total`, `text`, `datetime` from `transactions` where
      `user_id` = ?
      and (? is NULL or `category_id` = ?)
      and (? is NULL or `datetime` < ?)
      and (? is NULL or `datetime` > ?)
      order by `datetime`");
    $stm->execute(array($user_id,
        $category_id, $category_id,
        $to_date, $to_date,
        $from_date, $from_date));
    $data = $stm->fetchAll(PDO::FETCH_ASSOC);

    return $data;
}

/**
 * @param $pdo
 * @return mixed
 */
function transaction_details($pdo)
{
    $id = $_GET['id'];

    $stm = $pdo->prepare("select `category_id`, `total`, `text`, `datetime` from `transactions` where `id` = ?");
    $stm->execute(array($id));
    $data = $stm->fetch(PDO::FETCH_ASSOC);

    return $data;
}


?>