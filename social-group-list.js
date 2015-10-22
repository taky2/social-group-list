

Tasks = new Mongo.Collection('tasks');


if (Meteor.isClient) {

  //configure the accounts UI to use usernames instead of email addresses
  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  }); 

  // This code only runs on the client
  angular.module('simple-todos',['angular-meteor']);

  function onReady() {
    angular.bootstrap(document, ['simple-todos']);
  }

  //set up angular for mobile
  if (Meteor.isCordova)
    angular.element(document).on('deviceready', onReady);
  else
    angular.element(document).ready(onReady);

  angular.module('simple-todos').controller('TodosListCtrl', ['$scope', '$meteor',

    function ($scope, $meteor) {

      // Subscribes to Meteor.publish method in the client (below) by running function(s) 
      // asynchronously returning values (in the form of a AngularJS promise) when ready.
      // * Allows implementation of private info in database
      $scope.$meteorSubscribe('tasks');
 
      //return result of calling find function with the sort parameter on Tasks collection
      $scope.tasks = $meteor.collection(function() {
        //turn angular scope variables into meteor reactive variables
        return Tasks.find($scope.getReactively('query'), { sort: { createdAt: -1 } })
      });

      // DEFINE METHODS FOR CLIENT PERMISSIONS - (PROVIDES DATABASE SECURITY) 
      $scope.addTask = function (newTask) {
        $meteor.call('addTask', newTask);
      };

      $scope.deleteTask = function (task) {
        $meteor.call('deleteTask', task._id);
      };

      $scope.setChecked = function (task) {
        $meteor.call('setChecked', task._id, !task.checked);
      };

      $scope.setPrivate = function (task) {
        $meteor.call('setPrivate', task._id, !task.private);
      };

      //create a scope variable that will hold the wanted query and change with checkbox
      $scope.$watch('hideCompleted', function() {
        if ($scope.hideCompleted)
          $scope.query = { checked: {$ne: true} };
        else
          $scope.query = {};
      })

      //add a count of incomplete tasks
      $scope.incompleteCount = function () {
        return Tasks.find({ checked: {$ne: true} }).count();
      };

    }]);
}

// DEFINE METHODS FOR ADDING, REMOVING, COMPLETING TO-DO ITEMS (FOR DATABASE SECURITY)
// * After removing angular's "insecure" package dependency, it becomes necessary to 
//   seperately define such methods to provide better database security by separating 
//   the client code from database logic. 
// * This enables a feature in Meteor called optimistic UI. When calling a method on
//   the client using Meteor.call, two things happen:
//      (1) Client sendsreq uest to server to run the method in a secure environment.
//      (2) A simulation of the method runs directly on the client in an attempt to 
//          predict the outcome of the server call using the available information.
//   Optimistic UI displays the new task on screen before the sever result returns.
//   If the result from the server is inconsistent with the client-side simulation, 
//   the UI is updated to reflect the state of the server. 
// * Angular provides the MVC framework for databinding with the UI. 
Meteor.methods({
  addTask: function (text) {
    if (! Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }
    //add fields for usernames etc
    Tasks.insert({
      text: text,
      createdAt: new Date(),            //current time
      owner: Meteor.userId(),           // _id of logged-in user
      username: Meteor.user().username  //username of logged-in user
    });
  },
  deleteTask: function (taskId) {
    var task = Tasks.findOne(taskId);
    //if task is private, make sure only the owner can delete it
    if (task.private && task.owner !== Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }
    Tasks.remove(taskId);
  },
  setChecked: function (taskId, setChecked) {
    var task = Tasks.findOne(taskId);
    //if task is private, make sure only the owner can mark it complete
    if (task.private && task.owner !== Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }
    Tasks.update(taskId, { $set: { checked: setChecked} });
  },
  setPrivate: function (taskId, setToPrivate) {
    var task = Tasks.findOne(taskId);
    //make sure only the task owner can make a task private
    if (task.owner !== Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }
    Tasks.update(taskId, { $set: { private: setToPrivate } });
  }

});

// Removed 'autopublish' package dependency from meteor so that the entire database 
// is not automatically present on the client side.  
// * This function specifies explicitly what the server sends to the client.
if (Meteor.isServer) {
  Meteor.publish('tasks', function () {
    return Tasks.find({
      //only send items that user is authorized to see
      $or: [
        { private: {$ne: true} },
        { owner: this.userId }
      ]
    });
  });  
}

