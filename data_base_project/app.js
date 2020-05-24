
const express = require("express");
const exphbs = require("express-handlebars");
const bodyParser= require("body-parser");
var mysql=require('mysql');


var PORT=process.env.PORT||3000;
const app = express();

app.engine("handlebars", exphbs());

app.set("view engine", "handlebars");

app.use(bodyParser.urlencoded({extended: true})); 
app.use(express.static('public'));  //public folder, use for styling





// create table items(barcode_id int auto_increment primary key, item_name varchar(20), img_url varchar(200), department varchar(20), taxable varchar(5), unit_price double, price_unit varchar(5), case_price double , num_lb_in_case double, cases_in_stock int);    
// insert into items (item_name, img_url,department,taxable,unit_price,price_unit,case_price,num_lb_in_case,cases_in_stock) values ('','','Fruit','No',0.60,'Each', 16, 30,15);   

var db = mysql.createConnection({
    host     : 'testinstance.ct7lrszoc875.us-east-1.rds.amazonaws.com',
    user     : 'admin',
    password: 'Ljx756114194',
    port: 3306,
    database: 'mydb'
});

db.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});


var current_user;
var current_user_id;
var shoppingArr;

app.get("/", function(req, res) {
  res.render("login",{title:'LogIn Page', style:'login.css'});
});

app.get("/newUser",function(req,res){
	res.render("signup", {title:'Sign Up Page', style:'signup.css'});
});

app.post('/newAccount',function(req,res){
	var userN=req.body.username;
	var email=req.body.email;
	var pass =req.body.password;
	var address=req.body.address;
	var phone=req.body.phone;
	
	var checkRepeat=0;

	let p= new Promise((resolve,reject)=>{
		
		db.query("SELECT * FROM customers", function (err, result, fields) {
		    if (err) throw err;
			    result.map((element,index)=>{
		    	
				if(element.username===userN){
					checkRepeat=1;	
					console.log('first, '+checkRepeat);    
				}
			});
			if(checkRepeat===1){
				resolve(checkRepeat);
							
			}else if(checkRepeat===0){
				console.log("not repeat");
				var sql = "INSERT INTO customers (username,email,passowrd, address,phone) VALUES ('"+ userN+"','"+ email+"','"+pass+"','"+address+"','"+phone+"')";
				console.log(sql);
				db.query(sql, function (err, result) {
					if (err) throw err;
						console.log("1 record inserted");
				});
				resolve(checkRepeat);
			}
			else{
				reject('Failed');
			}
		});	
	});	
		
	p.then((message)=>{
		console.log(message);
		if(message===1){
			res.render("signup");
		}else{
			res.redirect("/");
		}
	});
		
});
app.post("/home",function(req, res){

	var userN=req.body.username;
	var pass =req.body.password;
	var checkUser=0;
	let p= new Promise((resolve,reject)=>{	
		db.query("SELECT * FROM customers", function (err, result, fields) {
			if (err) throw err;
			result.map((element,index)=>{
					    	
				if(element.username=== userN&& element.passowrd===pass){
				   	checkUser=1;	
				   	current_user=userN;
				   	current_user_id=element.cid;
				   	console.log(checkUser);   	    
				}
			});
			if(checkUser===1 || checkUser===0){
				resolve(checkUser);
			}
			else{
				reject('Failed');
			}
		});    
    });	
    p.then((message)=>{
		console.log(message);
		if(message===1){
			res.redirect('/listAllItems');
			
		}else{
			res.redirect("/");
		}
	});
		
});
app.get('/listAllItems',function(req,res){
	var items=[];
			let pr= new Promise((resolve,reject)=>{
				db.query("SELECT * FROM items", function (err, result, fields) {
					if (err) throw err;
					result.map((element,index)=>{  	
						items.push(element);
					});
					if(items.length>=1){
						resolve("Success");
					}else{
						reject('Failed');
					}
				
				});    
			});
			pr.then((message1)=>{
				console.log(message1);
				if(message1==="Success"){
					res.render("home",{title:'Home Page', style: 'home.css', username:current_user, items:items});
				}else{
					res.redirect('/');
				}
			});
});

app.get("/itemlist/:param2", function(req, res){
	var id=parseInt(req.params.param2);
	var el;
	var outOfStock=false;
	var remain;
	var item_N;
	var unit_in_lb=false;
	let j= new Promise((resolve,reject)=>{	
		db.query("SELECT * FROM items", function (err, result, fields) {
			if (err) throw err;
			result.map((element,index)=>{
				if(id===element.barcode_id){
					el=element;
					if(element.cases_in_stock*element.num_lb_in_case===0)
					{
						outOfStock=true;
					}
					remain = element.num_lb_in_case*element.cases_in_stock+element.remain_not_in_case;

					if(element.price_unit==='lb')
					{
						unit_in_lb=true;
					}
					item_N=element.item_name;
					
				}
			});
			res.render("item",{title:item_N, style: 'item.css',username:current_user, element:el, outOfStock:outOfStock, remain:remain, unit_in_lb:unit_in_lb});
		});
	});

});

app.post("/add/:param1",function(req,res){
	var itemId=parseInt(req.params.param1);
	var num=parseInt(req.body.add);
	var excessive=false;
	db.query("SELECT * FROM items", function (err, result, fields) {
			if (err) throw err;
			result.map((element,index)=>{
				if(itemId===element.barcode_id){
					if(num>element.num_lb_in_case*element.cases_in_stock){
						 excessive=true;
					}else{
						var sql = "INSERT INTO shoppingcart (cid,item,quantity) VALUES ('"+ current_user_id+"','"+ itemId+"','"+num+"')";
						console.log(sql);
						db.query(sql, function (err, result) {
							if (err) throw err;
							console.log("1 record inserted");
						});
					}
				}
			});
			res.redirect("/itemlist/"+itemId);
		});

});

app.get("/shoppingcart/:param1",function(req,res){

	var para=parseInt(req.params.param1);
	if(para===1){
		var arr=[];
		var total=0;
		var anwser;
		var single_tax=0;
		var total_tax=0;

		var sql="select cid, b.item_name, quantity, b.unit_price, b.taxable from shoppingcart as a join (select barcode_id,item_name, unit_price,taxable from items) as b on b.barcode_id=item and cid="+current_user_id;
		db.query(sql, function (err, result, fields) {
			if (err) throw err;
			answer=result;
			
			result.map((element,index)=>{
				var cur_p=element.unit_price*element.quantity;
				single_tax=0;
				arr.push({
					item_name:element.item_name, 
					quantity: element.quantity, 
					unit_price:element.unit_price, 
					current_price: cur_p.toFixed(2)
				});
				
				if(element.taxable==="Yes"){
					single_tax=(element.unit_price*element.quantity*1.08875)-(element.unit_price*element.quantity);
					total_tax+=single_tax;
				}
				total+=((element.unit_price*element.quantity)+single_tax);
			});

			total_tax=total_tax.toFixed(2);
			total=total.toFixed(2);
			
			shoppingArr=arr;
			res.render("shoppingcart",{title:'Shopping Cart',arr:arr,total:total,total_tax:total_tax});
		
		});
	}else{
		res.render("shoppingcart",{title:'Shopping Cart',arr:shoppingArr,total:0,tax:0});
	}

});


app.get("/delete/:name", function(req,res){

});

app.get("/update/:name", function(req,res){
	
});

app.get('/pay',function(req,res){

	res.render("payment");

});


function check(item){
	db.query("SELECT barcode_id,item_name,cases_in_stock,num_lb_in_case, remain_not_in_case FROM items", function (err, result, fields) {
			if (err) throw err;
			result.map((element,index)=>{
				if(item.item_name===element.item_name){
				    var remainInStock=element.cases_in_stock*element.num_lb_in_case+element.remain_not_in_case;
					remainInStock-=item.quantity;
					var result_case= Math.floor(remainInStock/element.num_lb_in_case);
					var result_remain=remainInStock-(result_case*element.num_lb_in_case);
					result_remain=result_remain.toFixed(2);
					console.log(element.item_name+", "+remainInStock+ ", "+result_case+", "+result_remain);

					var sql= "UPDATE items SET remain_not_in_case="+ result_remain+" where item_name='"+ item.item_name +"'";
					db.query(sql, function (err, result) {
						if (err) throw err;
							console.log("1 record updated");
					});
					if(result_case===item.cases_in_stock){

					}else{
						var sql_case= "UPDATE items SET cases_in_stock="+ result_case+" where item_name='"+ item.item_name +"'";
						db.query(sql_case, function (err, result) {
							if (err) throw err;
								console.log("1 record updated");
						});
					}
					var sql_delete_item_sc="DELETE FROM shoppingcart WHERE cid="+current_user_id;
					
					db.query(sql_delete_item_sc, function (err, result) {
						if (err) throw err;
							console.log("1 record deleted");
					});
					shoppingArr=[];	
				}
			});
		});
	
}
app.get('/finish',function(req,res){
	shoppingArr.map((item,pos)=>{
		check(item);
	});

	res.redirect('/shoppingcart/0');
		
});


app.listen(PORT,function(){
	console.log("Server is running");
});

